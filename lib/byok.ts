import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { admin, ApiError } from './server';
import { byokSettingsSchema, isAllowedByokUrl } from './validation';
export { byokSettingsSchema } from './validation';

export type ByokSettings = { provider: 'openai-compatible'; model: string; baseUrl: string; apiKey: string };
export type ByokMetadata = { provider: 'openai-compatible'; model: string; baseUrl: string; updatedAt: string };

function encryptionKey(): Buffer {
  const value = process.env.AI_BYOK_ENCRYPTION_KEY?.trim();
  if (!value) throw new ApiError(503, 'BYOK encryption is not configured.');
  const decoded = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  if (decoded.length !== 32) throw new ApiError(503, 'BYOK encryption is not configured correctly.');
  return decoded;
}

export function validateByokSettings(input: ByokSettings): ByokSettings {
  if (!isAllowedByokUrl(input.baseUrl)) throw new ApiError(400, 'Only public HTTPS AI endpoints are allowed; localhost is development-only.');
  return { ...input, baseUrl: new URL(input.baseUrl).toString().replace(/\/$/, '') };
}

function encrypt(apiKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  return { encrypted_key: encrypted.toString('base64'), iv: iv.toString('base64'), auth_tag: cipher.getAuthTag().toString('base64') };
}
function decrypt(row: { encrypted_key: string; iv: string; auth_tag: string }) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(row.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(row.encrypted_key, 'base64')), decipher.final()]).toString('utf8');
}

export async function getByok(userId: string): Promise<(ByokSettings & { updatedAt: string }) | null> {
  const { data, error } = await admin().from('ai_byok_settings').select('provider,model,base_url,encrypted_key,iv,auth_tag,updated_at').eq('user_id', userId).maybeSingle();
  if (error) { if (error.code === 'PGRST205' || error.code === '42P01') return null; throw new ApiError(503, 'AI settings are temporarily unavailable.'); }
  if (!data) return null;
  try { return { provider: data.provider, model: data.model, baseUrl: data.base_url, apiKey: decrypt(data), updatedAt: data.updated_at }; }
  catch { throw new ApiError(503, 'AI settings are temporarily unavailable.'); }
}

export async function saveByok(userId: string, input: ByokSettings): Promise<ByokMetadata> {
  const settings = validateByokSettings(input);
  const { data, error } = await admin().from('ai_byok_settings').upsert({ user_id: userId, provider: settings.provider, model: settings.model, base_url: settings.baseUrl, ...encrypt(settings.apiKey), updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select('provider,model,base_url,updated_at').single();
  if (error || !data) throw new ApiError(503, 'AI settings could not be saved.');
  return { provider: data.provider, model: data.model, baseUrl: data.base_url, updatedAt: data.updated_at };
}

export async function readByokMetadata(userId: string): Promise<ByokMetadata | null> {
  const { data, error } = await admin().from('ai_byok_settings').select('provider,model,base_url,updated_at').eq('user_id', userId).maybeSingle();
  if (error) { if (error.code === 'PGRST205' || error.code === '42P01') return null; throw new ApiError(503, 'AI settings are temporarily unavailable.'); }
  return data ? { provider: data.provider, model: data.model, baseUrl: data.base_url, updatedAt: data.updated_at } : null;
}

export async function deleteByok(userId: string) {
  const { error } = await admin().from('ai_byok_settings').delete().eq('user_id', userId);
  if (error) throw new ApiError(503, 'AI settings could not be deleted.');
}
