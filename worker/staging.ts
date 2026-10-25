import handler from 'vinext/server/fetch-handler';
import { routeClubRequest } from '../server/worker-router';
export { ClubTable } from '../server/club-table';

declare const __STAGING_BUILD_COMMIT__: string;

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const response = await routeClubRequest(request, env, __STAGING_BUILD_COMMIT__);
    return response || handler.fetch(request, env, ctx);
  },
};
