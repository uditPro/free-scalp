import { supabase, response, route } from '@/lib/server';
import { readSession } from '@/lib/session-state';
export const dynamic = 'force-dynamic';
export const GET = route(async () => {
  return response(await readSession(await supabase()));
});
