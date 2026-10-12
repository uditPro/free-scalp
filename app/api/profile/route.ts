import { profileSchema } from '@/lib/validation';
import { admin, checkOrigin, identity, json, response, route } from '@/lib/server';
import { profileCompletion } from '@/lib/candidate-workflow';
export const GET = route(async () => { const { user } = await identity(); const db = admin(); const { data, error } = await db.from('profiles').select('candidate_profile').eq('id', user.id).single(); if (error) throw error; const profile = data?.candidate_profile ?? {}; return response({ profile, completion: profileCompletion(profile) }); });
export const PUT = route(async request => { checkOrigin(request); const input = await json(request, profileSchema); const { user } = await identity(); const db = admin(); const { error } = await db.from('profiles').update({ candidate_profile: input }).eq('id', user.id); if (error) throw error; return response({ profile: input, completion: profileCompletion(input) }); });
