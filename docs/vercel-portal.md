# Public faculty portal deployment

Use **https://faculty-portal-chi.vercel.app** as the public production address.
Vercel's versioned deployment URLs and Git branch aliases can be protected by
Vercel sign-in; they are not replacement public login links. A deployment URL
keeps the environment values from its original build even after settings change.

The existing Vercel project is `cxen77s-projects/faculty-portal`, connected to
the GitHub repository's `faculty-portal` root directory with the Vite preset.
Keep that root directory. Build command: `npm run build`; output: Vite's `dist`.

Configure these values for Production, Preview and Development:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://yurdfoblkaclivxqfpjt.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The public publishable key from that project |
| `VITE_API_BASE_URL` | `https://presentia-6zjr.onrender.com` |

Never put a secret/service-role key in a `VITE_` variable. Do not commit local
environment files. Redeploy after changing environment variables: Vite embeds
them into its JavaScript bundle; a browser refresh cannot change an old build.

`faculty-portal/vercel.json` sends application paths such as `/login`, `/admin`,
`/classes` and `/reports` to the SPA entry point. Static assets retain their normal
paths. `index.html` references the actual `/favicon.svg` asset.

The build and runtime share `readPortalConfiguration`, which rejects a different
Supabase project, privileged keys, and a localhost/foreign production backend.
Opaque publishable keys must also be verified against the intended project's
`/auth/v1/settings` endpoint before deploying; never print the key during checks.

Render's CORS policy includes only the verified stable aliases for this portal
alongside the explicit `ALLOWED_ORIGINS` configuration. It does not allow arbitrary
Vercel projects. Supabase authentication and faculty/admin role checks still apply
to every protected backend request.

After deployment, verify `/`, `/login`, `/classes` and `/favicon.svg`, inspect the
compiled public-project hostname, and test a real staff login plus authenticated
backend profile/class reads with the public portal's Origin header. Also test
preflight responses. The favicon 404 is cosmetic; wrong-project authentication,
missing SPA routing, and disallowed backend origins are independent failures.
