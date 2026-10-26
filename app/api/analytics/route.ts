import { sitePresenceSchema } from '@/lib/validation';
import { admin, json, response, route } from '@/lib/server';

export const dynamic = 'force-dynamic';

function utcDate() { return new Date().toISOString().slice(0, 10); }

export const POST = route(async request => {
  const input = await json(request, sitePresenceSchema);
  const db = admin();
  const now = new Date().toISOString();
  const { error: sessionError } = await db.from('site_visitor_sessions').upsert({ visitor_id: input.visitorId, last_seen_at: now, last_path: input.path }, { onConflict: 'visitor_id' });
  if (sessionError) throw sessionError;
  const { error: visitError } = await db.from('site_visit_events').upsert({ visitor_id: input.visitorId, visit_date: utcDate(), path: input.path }, { onConflict: 'visitor_id,visit_date', ignoreDuplicates: true });
  if (visitError) throw visitError;
  return response({ recorded: true });
});

export const GET = route(async () => {
  const db = admin();
  const today = utcDate();
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const [visits, active] = await Promise.all([
    db.from('site_visit_events').select('id', { count: 'exact', head: true }).eq('visit_date', today),
    db.from('site_visitor_sessions').select('visitor_id', { count: 'exact', head: true }).gt('last_seen_at', cutoff),
  ]);
  if (visits.error) throw visits.error;
  if (active.error) throw active.error;
  return response({ todayVisits: visits.count ?? 0, activeUsers: active.count ?? 0, activeWindowMinutes: 5, measuredAt: new Date().toISOString() });
});
