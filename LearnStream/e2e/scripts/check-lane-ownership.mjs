#!/usr/bin/env node
// Enforces docs/contracts/registries.md's ownership rule: every file a
// lane's branch changed, relative to its integration base, must fall inside
// that lane's own `owns` ∪ `appends` globs (docs/lanes/<lane>.json). This is
// what lets N parallel worktree lanes (ten in Wave 1) run at once without
// touching each other's files — a lane that strays outside its manifest
// fails this check instead of silently landing a conflicting change. Runs
// as part of every lane's definition of done (plan §10.4).
//
// Usage:
//   node e2e/scripts/check-lane-ownership.mjs <lane> [baseRef]
//   LANE_BASE_REF=<ref> node e2e/scripts/check-lane-ownership.mjs <lane>
//
// baseRef resolves, in order: the second CLI arg, the LANE_BASE_REF env var,
// then `integration/w<lane.wave>` read off the lane's OWN manifest — not a
// hardcoded "w0" — so this keeps working unmodified once integration/w1,
// integration/w2, ... exist; only `integration/w0` exists today, which is
// why that's what every Wave 0 lane resolves to by default.
//
// docs/lanes/*.json globs are written relative to the LearnStream/ app
// root (e.g. "e2e/playwright.config.ts"), not the outer git repository
// root (this repo keeps LearnStream/ as a subdirectory alongside top-level
// docs). This script's own location (LearnStream/e2e/scripts/) is used to
// find that app root, and diffed paths are rewritten relative to it before
// matching.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '../..'); // .../LearnStream

function fail(message) {
  console.error(`check-lane-ownership: ${message}`);
  process.exit(1);
}

const [, , laneName, baseRefArg] = process.argv;
if (!laneName) {
  fail('usage: check-lane-ownership.mjs <lane> [baseRef]');
}

const laneFile = path.join(APP_ROOT, 'docs/lanes', `${laneName}.json`);
if (!fs.existsSync(laneFile)) {
  fail(`no such lane manifest: ${laneFile}`);
}

let lane;
try {
  lane = JSON.parse(fs.readFileSync(laneFile, 'utf-8'));
} catch (err) {
  fail(`could not parse ${laneFile}: ${err.message}`);
}

const owns = Array.isArray(lane.owns) ? lane.owns : [];
const appends = Array.isArray(lane.appends) ? lane.appends : [];
const globs = [...owns, ...appends];

if (globs.length === 0) {
  fail(`${laneFile} has no "owns" or "appends" entries — nothing this lane could legitimately change.`);
}

const baseRef =
  baseRefArg ||
  process.env.LANE_BASE_REF ||
  `integration/w${typeof lane.wave === 'number' ? lane.wave : 0}`;

// --- minimal glob matching --------------------------------------------------
// Patterns actually used across docs/lanes/*.json: exact paths
// ("backend/tests/setup.js"), "dir/**" (any depth under dir), a wildcard
// confined to one path segment ("dir/*", "e2e/seeds/*.seed.ts",
// "backend/scripts/backfill-w0-*", "frontend/src/features/*/index.js"), and
// the single pattern "**" (matches everything; used only by the Wave 4
// consolidation lane). None of these ever put "**" anywhere but immediately
// after a "/" or as the whole pattern, so translating every run of 2+ "*"
// as ".*" (crosses "/") and every single "*" as "[^/]*" (stays within one
// segment) covers all of them without needing a real glob library.
function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        out += '.*';
        i += 1; // consume both stars
      } else {
        out += '[^/]*';
      }
    } else if ('.+^${}()|[]\\'.includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
}

const globRegExps = globs.map(globToRegExp);
function isOwned(filePath) {
  return globRegExps.some((re) => re.test(filePath));
}

// --- diff against baseRef ---------------------------------------------------
let gitRoot;
try {
  gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: APP_ROOT,
    encoding: 'utf-8',
  }).trim();
} catch (err) {
  fail(`git rev-parse --show-toplevel failed: ${err.message}`);
}

// e.g. "LearnStream" if the git root is one level above APP_ROOT, "" if
// APP_ROOT itself is the git root.
const appPrefix = path.relative(gitRoot, APP_ROOT).split(path.sep).filter(Boolean).join('/');

let changedFiles;
try {
  const out = execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
    cwd: gitRoot,
    encoding: 'utf-8',
  });
  changedFiles = out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
} catch (err) {
  fail(`git diff --name-only ${baseRef}...HEAD failed: ${err.message}`);
}

if (changedFiles.length === 0) {
  console.log(`check-lane-ownership: no changes relative to ${baseRef} — nothing to check.`);
  process.exit(0);
}

// Rewrite each path relative to APP_ROOT (stripping the "LearnStream/"
// prefix) before matching, since that's what the manifests' globs are
// written relative to. A changed file outside APP_ROOT entirely (e.g. a
// repo-root doc) keeps its full repo-relative path, which correctly matches
// no lane glob and is reported as an offender — no lane's manifest grants
// it permission to touch files outside LearnStream/.
function toAppRelative(filePath) {
  if (appPrefix && filePath.startsWith(`${appPrefix}/`)) {
    return filePath.slice(appPrefix.length + 1);
  }
  return filePath;
}

const offenders = changedFiles.filter((f) => !isOwned(toAppRelative(f)));

if (offenders.length > 0) {
  console.error(
    `check-lane-ownership: lane "${laneName}" changed ${offenders.length} file(s) outside its ownership ` +
      `manifest (${path.relative(gitRoot, laneFile)}) relative to ${baseRef}:\n` +
      offenders.map((f) => `  - ${f}`).join('\n') +
      '\n\nEach changed file must match at least one glob in "owns" or "appends" for this lane.'
  );
  process.exit(1);
}

console.log(
  `check-lane-ownership: OK — all ${changedFiles.length} changed file(s) relative to ${baseRef} are within lane "${laneName}"'s ownership.`
);
