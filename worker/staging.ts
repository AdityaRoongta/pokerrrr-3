import handler from 'vinext/server/fetch-handler';
import { stagingResponse } from '../lib/staging-handler.mjs';

declare const __STAGING_BUILD_COMMIT__: string;

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const response = stagingResponse(request, env.APP_ENV || 'unknown', __STAGING_BUILD_COMMIT__);
    return response || handler.fetch(request, env, ctx);
  },
};
