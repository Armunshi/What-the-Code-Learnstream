import { User, ROLES } from "../src/models/user.model.js";
import { Courses } from "../src/models/course.model.js";
import { Modules } from "../src/models/module.model.js";
import { Lectures } from "../src/models/lecture.model.js";

let counter = 0;
const unique = (label) => `${label}-${Date.now()}-${counter++}`;

export const createUser = async (role, overrides = {}) => {
  const user = await User.create({
    name: overrides.name ?? unique("name"),
    email: overrides.email ?? `${unique("user")}@example.com`,
    password: overrides.password ?? "password123",
    role,
  });
  return user;
};

export const createTeacher = (overrides) => createUser(ROLES.TEACHER, overrides);
export const createStudent = (overrides) => createUser(ROLES.STUDENT, overrides);

export const authHeader = (user) => ({ Authorization: `Bearer ${user.generateAccessToken()}` });

export const createCourse = async (teacher, overrides = {}) => {
  const course = await Courses.create({
    thumbnail: overrides.thumbnail ?? "https://example.com/thumb.jpg",
    title: overrides.title ?? unique("Course"),
    description: overrides.description ?? "A test course",
    price: overrides.price ?? 49900,
    author: teacher._id,
    category: overrides.category ?? "General",
    enrolledStudents: overrides.enrolledStudents ?? [],
  });
  await User.findByIdAndUpdate(teacher._id, { $push: { Courses: course._id } });
  return course;
};

export const enrollStudent = async (student, course) => {
  await Courses.findByIdAndUpdate(course._id, { $push: { enrolledStudents: student._id } });
  await User.findByIdAndUpdate(student._id, { $push: { Courses: course._id } });
};

export const createModuleWithContent = async (course, overrides = {}) => {
  const module = await Modules.create({
    title: overrides.title ?? unique("Module"),
    course: course._id,
  });

  const lecture = await Lectures.create({
    title: unique("Lecture"),
    videourl: "https://res.cloudinary.com/demo/video/upload/v1/sample.mp4",
    duration: 120,
    public_id: unique("public_id"),
    module_id: module._id,
  });

  module.lectures.push(lecture._id);
  await module.save();

  course.modules.push(module._id);
  course.lectures.push(lecture._id);
  await course.save();

  return { module, lecture };
};
