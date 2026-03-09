import { handleIngest } from './ingest';
import { handleApi } from './api';
import { handleCron } from './cron';

export interface Env {
  DB: D1Database;
  MAX_ENDPOINTS?: string;
  MAX_REQUESTS_PER_ENDPOINT?: string;
  MAX_BODY_BYTES?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Ingest: public, no auth required
    // Matches /in/{endpoint_id} — any HTTP method
    const ingestMatch = pathname.match(/^\/in\/([^/]+)\/?$/);
    if (ingestMatch) {
      return handleIngest(request, env, ingestMatch[1]);
    }

    // API routes (protected by Cloudflare Access)
    if (pathname.startsWith('/api/')) {
      return handleApi(request, env, pathname);
    }

    // All other routes are served by Cloudflare Pages (the SPA)
    // This worker only handles /in/* and /api/* — everything else falls through
    return new Response('Not Found', { status: 404 });
  },

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await handleCron(env);
  },
} satisfies ExportedHandler<Env>;
