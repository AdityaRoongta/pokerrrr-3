import { env } from 'cloudflare:workers';
import { routeClubRequest } from '../../../server/worker-router';
export const dynamic = 'force-dynamic';
// HTTP and WebSocket paths share one authoritative coordinator.
export async function GET(request: Request) {
  return (await routeClubRequest(request, env))!;
}
export const POST = GET;
