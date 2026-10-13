"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, LoaderCircle, LockKeyhole, Trash2 } from "lucide-react";

type ProviderSettings = {
  provider?: string;
  model?: string;
  baseUrl?: string;
  base_url?: string;
};
type SettingsResponse = { settings: ProviderSettings | null };

type AiStatus = { enabled?: boolean; mode?: "managed" | "deterministic" | string };

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "The request could not be completed. Please try again.");
  return data as T;
}

export default function AiSettings() {
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const [savedResponse, currentStatus] = await Promise.all([
        request<SettingsResponse>("/api/ai/settings"),
        request<AiStatus>("/api/ai/status"),
      ]);
      const saved = savedResponse.settings;
      setSettings(saved);
      setStatus(currentStatus);
      setModel(saved?.model ?? "");
      setBaseUrl(saved?.baseUrl ?? saved?.base_url ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI provider settings could not be loaded.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const savedResponse = await request<SettingsResponse>("/api/ai/settings", {
        method: "POST",
        body: JSON.stringify({ provider: "openai-compatible", apiKey, model: model.trim(), baseUrl: baseUrl.trim() }),
      });
      setSettings(savedResponse.settings); setApiKey("");
      setMessage("Provider saved securely. Your key is not shown again.");
      const currentStatus = await request<AiStatus>("/api/ai/status");
      setStatus(currentStatus);
    } catch (err) { setError(err instanceof Error ? err.message : "Provider settings could not be saved."); }
    finally { setSaving(false); }
  }

  async function remove() {
    setRemoving(true); setError(""); setMessage("");
    try {
      await request("/api/ai/settings", { method: "DELETE" });
      setSettings(null); setModel(""); setBaseUrl(""); setApiKey("");
      setStatus({ enabled: false, mode: "deterministic" });
      setMessage("Saved provider removed. ReachFlow will use deterministic fallback drafts.");
    } catch (err) { setError(err instanceof Error ? err.message : "Provider settings could not be removed."); }
    finally { setRemoving(false); }
  }

  const configured = !!settings;
  const deterministic = status?.mode === "deterministic" || (!status?.enabled && status !== null);

  return <section className="settings-card ai-settings-card" aria-labelledby="ai-settings-heading">
    <div className="settings-card-heading"><div><span className="settings-icon"><LockKeyhole size={17}/></span><h2 id="ai-settings-heading">Your AI provider</h2></div><span className={`service-badge ${configured && !deterministic ? "ready" : ""}`}>{configured ? "Configured" : "Not configured"}</span></div>
    <p className="ai-settings-intro">Use your own OpenAI-compatible provider for application drafts. ReachFlow never displays your saved key.</p>
    {configured && <p className="ai-configured-summary"><strong>Configured provider:</strong> {settings.provider === "openai-compatible" ? "OpenAI-compatible" : settings.provider} <span aria-hidden="true">·</span> <strong>Model:</strong> {settings.model}</p>}
    <div className={`ai-fallback ${deterministic ? "active" : ""}`} role="status"><CheckCircle2 size={16}/><span><strong>{deterministic ? "Deterministic fallback is active" : "Managed AI is active"}</strong><small>{deterministic ? "Drafts remain available without an AI key." : "Draft generation is using the configured provider."}</small></span></div>
    {loading ? <div className="ai-settings-loading" role="status"><LoaderCircle className="spin" size={16}/>Loading provider settings…</div> : <form className="ai-settings-form" onSubmit={save}>
      <label>Provider<select value="openai-compatible" aria-label="AI provider" disabled><option value="openai-compatible">OpenAI-compatible</option></select></label>
      <label>Base URL<input type="url" value={baseUrl} onChange={event => setBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1/chat/completions" required aria-describedby="ai-base-url-help"/></label>
      <p id="ai-base-url-help" className="muted small">Use the chat completions endpoint your provider documents.</p>
      <label>Model<input type="text" value={model} onChange={event => setModel(event.target.value)} placeholder="gpt-4o-mini" required autoComplete="off"/></label>
      <label className="ai-key-field">API key<input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={configured ? "Enter a new key to replace the saved key" : "Paste your provider key"} autoComplete="new-password" required aria-describedby="ai-key-help"/><KeyRound size={15}/></label>
      <p id="ai-key-help" className="muted small">For security, the saved key is never returned to this page. Enter a new key only when saving or replacing it.</p>
      {error && <p className="notice-inline error" role="alert">{error}</p>}{message && <p className="notice-inline success" role="status">{message}</p>}
      <div className="ai-settings-actions"><button className="button button-small" type="submit" disabled={saving || removing || !model.trim() || !baseUrl.trim() || !apiKey}>{saving ? <><LoaderCircle className="spin" size={15}/>Saving…</> : "Save provider"}</button>{configured && <button className="button button-outline button-small" type="button" onClick={remove} disabled={saving || removing}>{removing ? <><LoaderCircle className="spin" size={15}/>Removing…</> : <><Trash2 size={15}/>Remove</>}</button>}</div>
    </form>}
    <p className="ai-privacy-note"><strong>Privacy &amp; cost</strong> Your provider bills you directly. ReachFlow sends requests to the base URL you provide and does not retain or see your plaintext key after it is saved.</p>
  </section>;
}
