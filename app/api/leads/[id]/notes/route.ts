import { leadNoteSchema } from '@/lib/validation';
import { admin, checkOrigin, identity, json, response, route } from '@/lib/server';
import { ownedRow } from '@/lib/candidate-workflow';
type Ctx = { params: Promise<{ id: string }> };
export const POST = route(async (request: Request, context?: Ctx) => { checkOrigin(request); const input = await json(request, leadNoteSchema); const { user } = await identity(); const db = admin(); const id = (await context!.params).id; await ownedRow(db, 'leads', id, user.id); const { data, error } = await db.from('lead_notes').insert({ lead_id: id, user_id: user.id, body: input.body }).select('*').single(); if (error || !data) throw new Error('Note could not be saved.'); return response({ note: data }, 201); });
