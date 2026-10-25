export const STAGING_WORKER_NAME = 'dunzo-club-staging';
export function stagingResponse(request, environment, commit, ready = false) {
  const path = new URL(request.url).pathname;
  const options = { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } };
  if (path === '/api/health') return Response.json({
    app: 'Dunzo Club', environment, version: commit,
    mode: 'multiplayer', multiplayerReady: ready,
  }, options);
  return null;
}
