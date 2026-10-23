const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const intended = 'https://yurdfoblkaclivxqfpjt.supabase.co';
function runtime(platform = 'web', env = {}) {
  const calls = [], listeners = [];
  const client = { auth: {
    startAutoRefresh() { calls.push('start'); },
    stopAutoRefresh() { calls.push('stop'); },
  } };
  const storage = {};
  const context = vm.createContext({
    exports: {}, atob,
    process: { env: { EXPO_PUBLIC_SUPABASE_URL: intended, EXPO_PUBLIC_SUPABASE_KEY: 'sb_publishable_test', ...env } },
    require(name) {
      if (name === '@supabase/supabase-js') return {
        createClient(url, key, options) { calls.push({ url, options }); return client; },
        processLock: () => {},
      };
      if (name === '@react-native-async-storage/async-storage') return { __esModule: true, default: storage };
      if (name === 'react-native') return { Platform: { OS: platform }, AppState: {
        currentState: 'active', addEventListener(name, cb) { listeners.push(cb); },
      } };
      throw new Error(name);
    },
  });
  const evaluate = () => { context.exports = {}; vm.runInContext('(function(){' + compile('src/services/supabase.ts') + '\n})()', context); return context.exports; };
  return { context, evaluate, calls, listeners, storage };
}
test('Fast Refresh reuses one client and one native lifecycle listener', () => {
  const r = runtime('android');
  assert.equal(r.evaluate().supabase, r.evaluate().supabase);
  assert.equal(r.calls.filter(c => typeof c === 'object').length, 1);
  assert.equal(r.listeners.length, 1);
  r.listeners[0]('background'); r.listeners[0]('active');
  assert.deepEqual(r.calls.slice(-2), ['stop', 'start']);
  const options = r.calls[0].options.auth;
  assert.equal(options.storage, r.storage);
  assert.equal(options.persistSession, true);
  assert.equal(options.autoRefreshToken, true);
});
test('web enables redirect consumption and browser session persistence', () => {
  const r = runtime(); r.evaluate();
  assert.equal(r.calls[0].options.auth.detectSessionInUrl, true);
  assert.equal(r.calls[0].options.auth.persistSession, true);
  assert.equal(r.listeners.length, 0);
});
test('rejects wrong project, missing keys, and frontend server secrets', () => {
  for (const env of [
    { EXPO_PUBLIC_SUPABASE_URL: 'https://wrong.supabase.co' },
    { EXPO_PUBLIC_SUPABASE_KEY: '' },
    { EXPO_PUBLIC_SUPABASE_KEY: 'sb_secret_test' },
  ]) assert.throws(() => runtime('web', env).evaluate(), /Configure/);
});
test('rejects hot-swapping credentials without full reload', () => {
  const r = runtime(); r.evaluate();
  r.context.process.env.EXPO_PUBLIC_SUPABASE_KEY = 'sb_publishable_changed';
  assert.throws(() => r.evaluate(), /Fully reload/);
});
test('legacy JWT must have public role and matching project', () => {
  const jwt = payload => 'header.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.signature';
  assert.doesNotThrow(() => runtime('web', { EXPO_PUBLIC_SUPABASE_KEY: jwt({ ref: 'yurdfoblkaclivxqfpjt', role: 'anon' }) }).evaluate());
  for (const payload of [{ ref: 'wrong', role: 'anon' }, { ref: 'yurdfoblkaclivxqfpjt', role: 'service_role' }]) {
    assert.throws(() => runtime('web', { EXPO_PUBLIC_SUPABASE_KEY: jwt(payload) }).evaluate(), /Configure/);
  }
});
test('auth feedback distinguishes credentials, confirmation, network, expiry and duplicates', () => {
  const context = vm.createContext({ exports: {} });
  vm.runInContext(compile('src/services/authErrors.ts'), context);
  const message = context.exports.authErrorMessage;
  assert.match(message({ code: 'invalid_credentials' }), /Invalid email or password/);
  assert.match(message({ code: 'email_not_confirmed' }), /Confirm your email/);
  assert.match(message({ name: 'AuthRetryableFetchError' }), /internet connection/);
  assert.match(message({ code: 'refresh_token_not_found' }), /expired/);
  assert.match(message({ code: 'user_already_exists' }), /already exists/);
});
function registrationHarness(auth) {
  const context = vm.createContext({ exports: {}, require(name) {
    if (name === './supabase') return { supabase: { auth } };
    throw new Error(name);
  } });
  vm.runInContext(compile('src/services/registration.ts'), context);
  return context.exports;
}
test('password registration preserves the password and waits for confirmation', async () => {
  let request;
  const registration = registrationHarness({ async signUp(input) {
    request = input;
    return { data: { user: { identities: [{}] }, session: null }, error: null };
  } });
  const result = await registration.registerStudent(' student@example.com ', ' exact password ');
  assert.equal(request.email, 'student@example.com');
  assert.equal(request.password, ' exact password ');
  assert.equal(result.status, 'confirmation_required');
});
test('duplicate signup never reports successful authentication', async () => {
  const registration = registrationHarness({ async signUp() {
    return { data: { user: { identities: [] }, session: null }, error: null };
  } });
  assert.equal((await registration.registerStudent('student@example.com', 'password')).status, 'existing_account');
});
test('signup errors propagate and missing users cannot fabricate success', async () => {
  const failed = registrationHarness({ async signUp() { return { data: {}, error: new Error('SMTP failed') }; } });
  await assert.rejects(failed.registerStudent('student@example.com', 'password'), /SMTP failed/);
  const empty = registrationHarness({ async signUp() { return { data: {}, error: null }; } });
  await assert.rejects(empty.registerStudent('student@example.com', 'password'), /did not return a user/);
});
test('verification binds the code to the email and requires a confirmed real session', async () => {
  let request;
  const registration = registrationHarness({ async verifyOtp(input) {
    request = input;
    return { data: { user: { email_confirmed_at: '2026-10-23T00:00:00Z' }, session: { access_token: 'test' } }, error: null };
  } });
  await registration.verifySignupCode(' student@example.com ', ' 123456 ');
  assert.equal(request.email, 'student@example.com');
  assert.equal(request.token, '123456');
  assert.equal(request.type, 'email');
  await assert.rejects(registration.verifySignupCode('student@example.com', 'abc'), /numeric verification code/);
  const empty = registrationHarness({ async verifyOtp() { return { data: { user: {} }, error: null }; } });
  await assert.rejects(empty.verifySignupCode('student@example.com', '123456'), /verified session/);
});
test('expired codes are rejected and resending uses signup confirmation', async () => {
  let request;
  const registration = registrationHarness({
    async verifyOtp() { return { data: {}, error: new Error('Token expired') }; },
    async resend(input) { request = input; return { error: null }; },
  });
  await assert.rejects(registration.verifySignupCode('student@example.com', '123456'), /expired/);
  await registration.resendSignupCode(' student@example.com ');
  assert.equal(request.email, 'student@example.com');
  assert.equal(request.type, 'signup');
});

test('SMTP delivery failures are not shown as an internet connection problem', () => {
  const context = vm.createContext({ exports: {} });
  vm.runInContext(compile('src/services/authErrors.ts'), context);
  assert.match(context.exports.authErrorMessage({ name: 'AuthRetryableFetchError', message: 'Error sending confirmation email' }), /could not send your verification email/);
});
