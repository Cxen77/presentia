interface SessionResult {
  data: { session: { access_token: string } | null };
  error?: { name?: string } | null;
}
interface SessionAuth {
  getSession(): Promise<SessionResult>;
  refreshSession(): Promise<SessionResult>;
}
export class SessionExpiredError extends Error {
  constructor() {
    super(
      "Your session has expired. Sign in again with your current password.",
    );
    this.name = "SessionExpiredError";
  }
}
const refreshes = new WeakMap<SessionAuth, Promise<SessionResult>>();
function tokenFrom(result: SessionResult) {
  if (result.error?.name === "AuthRetryableFetchError")
    throw new Error(
      "Could not refresh your session. Check your connection and retry.",
    );
  if (result.error || !result.data.session) throw new SessionExpiredError();
  return result.data.session.access_token;
}
export async function authenticatedRequest(
  auth: SessionAuth,
  send: (token: string) => Promise<Response>,
) {
  const token = tokenFrom(await auth.getSession());
  const response = await send(token);
  if (response.status !== 401) return response;
  // A 401 is rejected by auth middleware before the operation runs. Retry once,
  // sharing refresh across concurrent requests; never retry permission denials.
  let refresh = refreshes.get(auth);
  if (!refresh) {
    refresh = auth.refreshSession().finally(() => refreshes.delete(auth));
    refreshes.set(auth, refresh);
  }
  const retry = await send(tokenFrom(await refresh));
  if (retry.status === 401) throw new SessionExpiredError();
  return retry;
}
export async function establishPasswordSession(
  auth: {
    signInWithPassword(credentials: {
      email: string;
      password: string;
    }): Promise<SessionResult>;
  },
  email: string,
  password: string,
  save: (password: string) => Promise<unknown>,
) {
  await save(password);
  // Updating a password can revoke the old refresh token. Authenticate using
  // the password the user just submitted instead of refreshing that old session.
  const result = await auth.signInWithPassword({ email, password });
  if (result.error || !result.data.session)
    throw new Error(
      "Your password was saved. Sign in again with that new password to open the workspace.",
    );
}
