import { purgeExpiredEndpoints } from './db';

export interface Env {
  DB: D1Database;
}

export async function handleCron(env: Env): Promise<void> {
  const result = await purgeExpiredEndpoints(env.DB);
  console.log(`[cron] Purged ${result.endpoints} expired endpoints and ${result.requests} associated requests`);
}
