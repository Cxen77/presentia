// Stable aliases belonging to the verified Presentia Vercel project. Never
// allow all *.vercel.app sites to make authenticated browser requests.
const portalOrigins=[
  'https://faculty-portal-chi.vercel.app',
  'https://faculty-portal-cxen77s-projects.vercel.app',
  'https://faculty-portal-git-main-cxen77s-projects.vercel.app',
];
export function allowedBrowserOrigins(configured:string) {
  return new Set([...configured.split(',').map(value=>value.trim()).filter(Boolean),...portalOrigins]);
}
