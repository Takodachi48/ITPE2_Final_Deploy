// server/scripts/authz-sweep.js
// Authorization sweep: for every protected route, verify anonymous / wrong role /
// non-owner faculty / non-enrolled student are denied.
import { env } from '../config/env.js';

const BASE = `http://localhost:${env.port || 4000}/api/v1`;

async function login(email, password) {
  const r = await fetch(BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const set = r.headers.get('set-cookie') || '';
  const cookies = {};
  for (const part of set.split(/,(?=\s*\w+=)/)) {
    const m = part.match(/([^=;,]+)=([^;]+)/);
    if (m) cookies[m[1].trim()] = m[2].trim();
  }
  return { status: r.status, cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') };
}


async function hit(method, path, cookie) {
  const r = await fetch(BASE + path, {
    method,
    headers: { Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  });
  return r.status;
}

const ACTORS = {
  anon: { cookie: '' },
};
const logins = await Promise.all([
  login('test_admin@example.com', 'Password123'),
  login('test_faculty@example.com', 'Password123'),
  login('authz_faculty@example.com', 'Password123'),
  login('test_student@example.com', 'Password123'),
  login('authz_student@example.com', 'Password123'),
]);
const [adminL, ownerFacL, otherFacL, enrolledStuL, otherStuL] = logins;
ACTORS.admin = { cookie: adminL.cookie };
ACTORS.ownerFaculty = { cookie: ownerFacL.cookie };
ACTORS.otherFaculty = { cookie: otherFacL.cookie };
ACTORS.enrolledStudent = { cookie: enrolledStuL.cookie };
ACTORS.otherStudent = { cookie: otherStuL.cookie };

const OWNER_SUBJECT = 'c6e99b57-c375-46a8-865a-bff078e4371d'; // IT000 owned by test_faculty
const ENROLLED_SUBJECT = 'c6e99b57-c375-46a8-865a-bff078e4371d';
const UNENROLLED_SUBJECT = '67a7f2b2-f739-4324-9d28-41ae931b28e1'; // IT101 (authz_student not enrolled)

const cases = [];
function add(label, method, path, allowedActors, deniedExpect) {
  cases.push({ label, method, path, allowedActors, deniedExpect });
}

// Faculty routes on owned subject
add('faculty subjects list', 'GET', '/faculty/subjects', ['admin', 'ownerFaculty', 'otherFaculty'], 401);
add('faculty subject get (owned)', 'GET', `/faculty/subjects/${OWNER_SUBJECT}`, ['admin', 'ownerFaculty'], 404);
add('faculty subject patch (owned)', 'PATCH', `/faculty/subjects/${OWNER_SUBJECT}`, ['admin', 'ownerFaculty'], 404);
add('faculty subject topics (owned)', 'GET', `/faculty/subjects/${OWNER_SUBJECT}/topics`, ['admin', 'ownerFaculty'], 404);
add('faculty subject report (owned)', 'GET', `/faculty/subjects/${OWNER_SUBJECT}/report`, ['admin', 'ownerFaculty'], 404);
add('faculty subject progress (owned)', 'GET', `/faculty/subjects/${OWNER_SUBJECT}/progress`, ['admin', 'ownerFaculty'], 404);

// Student routes
add('student subject get (enrolled)', 'GET', `/student/subjects/${ENROLLED_SUBJECT}`, ['enrolledStudent'], 404);
add('student subject topics (enrolled)', 'GET', `/student/subjects/${ENROLLED_SUBJECT}/topics`, ['enrolledStudent'], 404);
add('student subject grades (enrolled)', 'GET', `/student/subjects/${ENROLLED_SUBJECT}/grades`, ['enrolledStudent'], 404);
add('student subject get (unenrolled)', 'GET', `/student/subjects/${UNENROLLED_SUBJECT}`, ['enrolledStudent'], 404);

// Admin routes
add('admin profiles list', 'GET', '/admin/profiles', ['admin'], 403);

const results = [];
for (const c of cases) {
  for (const [actorName, actor] of Object.entries(ACTORS)) {
    const status = await hit(c.method, c.path, actor.cookie);
    const allowed = c.allowedActors.includes(actorName);
    const denied = status === 401 || status === 403 || status === 404;
    const ok = allowed ? !denied : denied;
    results.push({ label: c.label, actor: actorName, status, allowed, ok });
    if (!ok) console.log(`FAIL ${c.label} as ${actorName}: got ${status} (allowed=${allowed})`);
  }
}


const total = results.length;
const passed = results.filter((r) => r.ok).length;
console.log(`\nAuthz sweep: ${passed}/${total} passed`);

// Write markdown table to stdout for capture
console.log('\n| Route | Actor | Status | Result |');
console.log('|---|---|---|---|');
for (const r of results) {
  console.log(`| ${r.label} | ${r.actor} | ${r.status} | ${r.ok ? 'PASS' : 'FAIL'} |`);
}

process.exit(passed === total ? 0 : 1);
