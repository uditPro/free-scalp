import { byokSettingsSchema, deleteByok, readByokMetadata, saveByok } from '@/lib/byok';
import { checkOrigin, identity, json, response, route } from '@/lib/server';
export const GET = route(async () => { const { user } = await identity(); return response({ settings: await readByokMetadata(user.id) }); });
export const POST = route(async request => { checkOrigin(request); const input = await json(request, byokSettingsSchema); const { user } = await identity(); return response({ settings: await saveByok(user.id, input) }); });
export const DELETE = route(async request => { checkOrigin(request); const { user } = await identity(); await deleteByok(user.id); return response({ settings: null }); });
