// Regression proof for the requireCourseOwner guard (BACKEND_AUDIT.md §5.3,
// module B5). Run with: node scripts/verify-ownership-guards.mjs
//
// It boots the real backend against a throwaway in-memory MongoDB, creates two
// teachers who each own a course, and checks that neither can reach into the
// other's content.
//
// What it was written to catch: updateLecture/deleteLecture/deleteAssignment
// used to assert ownership of the course named in the URL and then mutate the
// lecture or assignment named in a *different* URL segment, with nothing
// checking the two were related. Against the code as of 7236227 this script
// reports Alice successfully rewriting Bob's lecture title to "OWNED BY ALICE"
// with a 200. It lives here so that can never quietly come back.
//
// Note the control is a PUT, not a DELETE: deleteLecture calls Cloudinary, and
// the credentials here are deliberately fake, so a DELETE control would fail
// for reasons that have nothing to do with authorization.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const E2E_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = path.resolve(E2E_ROOT, '../backend');
const PORT = 8123;

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: String(PORT),
  CORS_ORIGIN: 'http://localhost:2000',
  ACCESS_TOKEN_SECRET: 'test-access-secret',
  ACCESS_TOKEN_EXPIRY: '1d',
  REFRESH_TOKEN_SECRET: 'test-refresh-secret',
  REFRESH_TOKEN_EXPIRY: '10d',
  CLOUDINARY_CLOUD_NAME: 'x',
  CLOUDINARY_API_KEY: 'x',
  CLOUDINARY_API_SECRET: 'x',
  RAZORPAY_KEY_ID: 'x',
  RAZORPAY_KEY_SECRET: 'x',
});

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri().replace(/\/$/, '');

const mongoose = (await import(`${BACKEND}/node_modules/mongoose/index.js`)).default;
const { app } = await import(`${BACKEND}/src/app.js`);
await import(`${BACKEND}/src/db/index.js`);
await mongoose.connect(`${process.env.MONGODB_URI}/guardtest`);

const { UserTeacher } = await import(`${BACKEND}/src/models/user/userteachermodel.js`);
const { UserStudent } = await import(`${BACKEND}/src/models/user/userstudentmodel.js`);
const { Courses } = await import(`${BACKEND}/src/models/course.model.js`);
const { Modules } = await import(`${BACKEND}/src/models/module.model.js`);
const { Lectures } = await import(`${BACKEND}/src/models/lecture.model.js`);

const server = app.listen(PORT);
const base = `http://127.0.0.1:${PORT}`;

const call = (method, urlPath, token, body) =>
  fetch(`${base}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function makeTeacher(name) {
  const doc = await UserTeacher.create({
    name, email: `${name}@t.com`, password: 'password123', username: name,
  });
  return { doc, token: doc.generateAccessToken() };
}

async function makeCourse(teacher, title) {
  const course = await Courses.create({
    thumbnail: 'x', title, description: 'd', price: 100,
    author: teacher.doc._id, category: 'c',
  });
  const module = await Modules.create({ title: `${title}-m`, course: course._id });
  const lecture = await Lectures.create({
    title: `${title}-lec`, videourl: 'https://x/v.mp4', duration: 1,
    public_id: `pub-${title}`, module_id: module._id, course_id: course._id,
  });
  course.modules.push(module._id);
  course.lectures.push(lecture._id);
  await course.save();
  module.lectures.push(lecture._id);
  await module.save();
  return { course, module, lecture };
}

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} -> ${actual} (expected ${expected})`);
};

const alice = await makeTeacher('alice');
const bob = await makeTeacher('bob');
const alices = await makeCourse(alice, 'alices');
const bobs = await makeCourse(bob, 'bobs');

// The attack: Alice's own course_id paired with Bob's module_id and lecture_id.
const attackUrl = `/courses/${alices.course._id}/modules/${bobs.module._id}/lectures/${bobs.lecture._id}`;

check("DELETE bob's lecture via alice's course_id", (await call('DELETE', attackUrl, alice.token)).status, 403);

const attackPut = await call('PUT', attackUrl, alice.token, { title: 'OWNED BY ALICE' });
check("PUT    bob's lecture via alice's course_id", attackPut.status, 403);

const afterAttack = await Lectures.findById(bobs.lecture._id);
console.log(`      bob's lecture title after alice's attempt: ${JSON.stringify(afterAttack.title)}`);
check("alice did NOT rewrite bob's lecture title", afterAttack.title === 'OWNED BY ALICE' ? 0 : 1, 1);
check("bob's lecture still exists", afterAttack ? 1 : 0, 1);

// Controls: the owner's own access must still work, or the guard is just a wall.
const ownUrl = `/courses/${bobs.course._id}/modules/${bobs.module._id}/lectures/${bobs.lecture._id}`;
check('PUT own lecture (control)', (await call('PUT', ownUrl, bob.token, { title: 'renamed by owner' })).status, 200);
check("owner's edit applied", (await Lectures.findById(bobs.lecture._id)).title === 'renamed by owner' ? 1 : 0, 1);

// ---------------------------------------------------------------------------
// requireEnrollment (§1.1 / §3.7): paid content must not be readable by a
// signed-in student who never bought the course.
// ---------------------------------------------------------------------------
const outsider = await UserStudent.create({
  name: 'mallory', email: 'mallory@s.com', password: 'password123', username: 'mallory',
});
const outsiderToken = outsider.generateAccessToken();

const enrolled = await UserStudent.create({
  name: 'erin', email: 'erin@s.com', password: 'password123', username: 'erin',
});
const enrolledToken = enrolled.generateAccessToken();
bobs.course.enrolledStudents.push(enrolled._id);
await bobs.course.save();
enrolled.Courses.push(bobs.course._id);
await enrolled.save();

const lectureUrl = `/courses/${bobs.course._id}/modules/${bobs.module._id}/lectures/${bobs.lecture._id}`;

const outsiderRead = await call('GET', lectureUrl, outsiderToken);
check('GET a paid lecture as a non-enrolled student', outsiderRead.status, 403);
const leaked = JSON.stringify(outsiderRead.body?.data ?? {});
check('response carried no videourl', leaked.includes('videourl') ? 0 : 1, 1);
check('response carried no public_id', leaked.includes('public_id') ? 0 : 1, 1);

const enrolledRead = await call('GET', lectureUrl, enrolledToken);
check('GET the same lecture as an enrolled student (control)', enrolledRead.status, 200);
check('enrolled student still receives videourl', enrolledRead.body?.data?.videourl ? 1 : 0, 1);

check(
  'GET the same lecture as the owning teacher (control)',
  (await call('GET', lectureUrl, bob.token)).status,
  200,
);

check(
  'mark lecture complete as a non-enrolled student',
  (await call('POST', `/courses/${bobs.course._id}/lectures/${bobs.lecture._id}/complete`, outsiderToken)).status,
  403,
);

// §1.2 — cross-teacher student PII must stay closed.
check("GET alice's enrolled students as bob", (await call('GET', `/courses/${alices.course._id}/students`, bob.token)).status, 403);
check('GET own enrolled students (control)', (await call('GET', `/courses/${bobs.course._id}/students`, bob.token)).status, 200);

server.close();
await mongoose.disconnect();
await mongod.stop();

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
