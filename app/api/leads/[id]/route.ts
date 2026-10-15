import { leadPatchSchema } from '@/lib/validation';
import { admin, checkOrigin, identity, json, response, route, ApiError } from '@/lib/server';
import { ownedRow } from '@/lib/candidate-workflow';
type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, context?: Ctx) => { const { user } = await identity(); const lead = await ownedRow(admin(), 'leads', (await context!.params).id, user.id); const { data: notes } = await admin().from('lead_notes').select('*').eq('lead_id', lead.id).eq('user_id', user.id).order('created_at', { ascending: false }); return response({ lead, notes: notes ?? [] }); });
export const PATCH = route(async (request: Request, context?: Ctx) => { checkOrigin(request); const input = await json(request, leadPatchSchema); const { user } = await identity(); const db = admin(); const id = (await context!.params).id; await ownedRow(db, 'leads', id, user.id); const { data, error } = await db.from('leads').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id).select('*').single(); if (error || !data) throw new ApiError(404, 'Resource not found.'); return response({ lead: data }); });
