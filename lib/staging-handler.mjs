export const STAGING_WORKER_NAME = 'dunzo-club-staging';
export function stagingResponse(request, environment, commit) {
  const path = new URL(request.url).pathname;
  const options = { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } };
  if (path === '/api/health') return Response.json({
    app: 'pokerrrr-3', environment, version: commit,
    mode: 'practice-only', multiplayerReady: false,
  }, options);
  if (path === '/api/poker' || path.startsWith('/api/poker/')) return Response.json({
    error: 'Shared multiplayer is not connected in this staging build. Try a practice hand.',
    code: 'MULTIPLAYER_NOT_CONFIGURED',
  }, { ...options, status: 503 });
  return null;
}
