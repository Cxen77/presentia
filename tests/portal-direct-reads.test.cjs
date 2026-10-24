const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

function runtime(reply, role = 'faculty') {
  const requests = [];
  const supabase = createClient('https://example.supabase.co', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async url => {
      requests.push(new URL(url));
      const { data, status = 200 } = reply(requests.at(-1));
      return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  let now = Date.now();
  const context = vm.createContext({ exports: {}, Date: class extends Date { static now() { return now; } },
    localStorage: { getItem: () => JSON.stringify({ id: 'faculty-id', role, name: 'Teacher' }) },
    require(name) { if (name === './supabase') return { supabase }; throw new Error(name); },
  });
  vm.runInContext(ts.transpileModule(fs.readFileSync('faculty-portal/src/services/directReads.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return { ...context.exports, requests, advance: ms => { now += ms; } };
}

test('faculty dashboard reads bounded enrollment counts without downloading the roster', async () => {
  const c = runtime(() => ({ data: [{ id: 'class', faculty_id: 'faculty-id', class_enrollments: [{ count: 1600 }] }] }));
  const result = await c.getClassesDirect();
  assert.equal(result.ok, true);
  assert.equal(result.value[0].enrolledStudentsCount, 1600);
  assert.equal(c.requests.length, 1);
  assert.match(c.requests[0].searchParams.get('select'), /class_enrollments\(count\)/);
  assert.equal(c.requests[0].searchParams.get('faculty_id'), 'eq.faculty-id');
  assert.equal(c.requests[0].searchParams.get('class_enrollments.status'), 'eq.active');
});

test('active session includes only the latest QR token in one database round trip', async () => {
  const c = runtime(() => ({ data: [{ id: 'session', class_id: 'class', class: { course_code: 'CS209' },
    qr_tokens: [{ token: 'real-token', expires_at: '2026-10-24T10:00:00Z' }] }] }));
  const result = await c.getActiveSessionDirect();
  assert.equal(result.ok, true);
  assert.equal(result.value.currentToken, 'real-token');
  assert.equal(result.value.tokenExpiresAt, Date.parse('2026-10-24T10:00:00Z'));
  assert.equal(c.requests.length, 1);
  const query = c.requests[0].searchParams;
  assert.match(query.get('select'), /qr_tokens\(token,expires_at\)/);
  assert.equal(query.get('qr_tokens.limit'), '1');
  assert.equal(query.get('qr_tokens.order'), 'created_at.desc');
  assert.equal(query.get('limit'), '1');
  assert.equal(query.get('faculty_id'), 'eq.faculty-id');
});

test('missing QR grants fall back and stop repeat forbidden reads until cooldown expires', async () => {
  const c = runtime(() => ({ status: 403, data: { message: 'permission denied for table qr_tokens' } }));
  assert.equal((await c.getActiveSessionDirect()).ok, false);
  assert.equal((await c.getActiveSessionDirect()).ok, false);
  assert.equal(c.requests.length, 1);
  c.advance(5 * 60_000);
  assert.equal((await c.getActiveSessionDirect()).ok, false);
  assert.equal(c.requests.length, 2);
});

test('empty sessions stay empty and admin views use the authorized backend', async () => {
  const empty = runtime(() => ({ data: [] }));
  assert.equal((await empty.getActiveSessionDirect()).value, null);
  const admin = runtime(() => assert.fail('Admin must use backend'), 'admin');
  assert.equal((await admin.getActiveSessionDirect()).ok, false);
  assert.equal((await admin.getClassesDirect()).ok, false);
  assert.equal(admin.requests.length, 0);
});
