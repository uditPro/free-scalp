"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, LoaderCircle, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { api, safeExternalUrl } from "@/components/api-client";
import type { Lead } from "@/components/lead-results";
import { LEAD_STATUSES } from "@/lib/lead-workflow";

const unavailable = (field: string) => `Unavailable — not found in the public source for ${field.toLowerCase()}.`;
const quality = (score: number) => score >= 75 ? "High quality match" : score >= 50 ? "Moderate quality match" : "Low quality match";

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState("");

  useEffect(() => { params.then(({ id: next }) => { setId(next); api<{ lead: Lead }>(`/api/leads/${next}`).then(data => { setLead(data.lead); setNote(data.lead.notes ?? ""); }).catch(err => setError(err instanceof Error ? err.message : "Lead could not be loaded.")); }); }, [params]);
  async function patch(body: Record<string, string>) { if (!id) return; setSaving(true); try { const response = await fetch(`/api/leads/${id}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setLead(data.lead); } catch (err) { setError(err instanceof Error ? err.message : "Lead could not be updated."); } finally { setSaving(false); } }
  if (!lead) return <div className="lead-app"><main className="lead-main">{error ? <div className="notice notice-error">{error}</div> : <div className="loading-state"><LoaderCircle className="spin"/>Loading lead…</div>}</main></div>;

  const source = safeExternalUrl(lead.source_url);
  const contacts = lead.public_contacts ?? {};
   return <div className="lead-app"><header className="lead-header"><Link href="/leads/pipeline" className="back-link"><ArrowLeft size={15}/>Pipeline</Link><Link className="brand" href="/"><span className="brand-mark">⌘</span>reachflow<span className="brand-period">.</span></Link><span /></header><main id="main" className="lead-main detail-main"><div className="detail-heading"><span className="eyebrow">LEAD DETAIL</span><h1>{lead.business_name}</h1><p>{lead.industry || "Business lead"}{lead.location && ` · ${lead.location}`}</p></div>{error && <div className="notice notice-error">{error}</div>}<div className="detail-layout"><article className="career-card lead-detail-card"><div className="detail-score"><strong>{lead.score}</strong><span>fit score</span></div><div className="lead-data-grid"><div><small>Contact person / role</small><strong>{lead.contact_name || unavailable("contact person")}<br />{lead.contact_role || unavailable("contact role")}</strong></div><div><small>Email</small>{contacts.emails?.length ? contacts.emails.map(email => <a key={email} href={`mailto:${email}`}>{email}</a>) : <strong>{unavailable("email")}</strong>}</div><div><small>Phone</small>{contacts.phones?.length ? contacts.phones.map(phone => <a key={phone} href={`tel:${phone}`}>{phone}</a>) : <strong>{unavailable("phone")}</strong>}</div><div><small>Location</small><strong>{lead.location || unavailable("location")}</strong></div><div><small>Industry</small><strong>{lead.industry || unavailable("industry")}</strong></div><div><small>Need signal</small><strong>{lead.need_signal || unavailable("need signal")}</strong></div></div><div className="lead-quality"><span><small>Fit score</small><strong>{lead.score} · {quality(lead.score)}</strong></span><span><small>Extraction quality</small><strong>{lead.quality_score ?? lead.score_explanation?.qualityScore ?? 0}/100</strong></span></div>{lead.evidence && <details className="lead-evidence"><summary>View extracted evidence</summary><div className="evidence-list">{Object.entries(lead.evidence).map(([key, value]) => <p key={key}><strong>{key.replaceAll('_', ' ')}:</strong> {value}</p>)}</div></details>}{lead.description && <details className="lead-evidence"><summary>View raw provider excerpt</summary><p>{lead.description}</p></details>}{source ? <a className="button button-outline button-small result-url" href={source} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>Verify source</a> : <p className="field-unavailable">{unavailable("source")}</p>}<p className="lead-disclosure">Public business data only; no guaranteed buying intent. Verify the source before outreach.</p></article><aside className="career-card lead-edit-card"><label className="status-label">Pipeline status<select value={lead.status} disabled={saving} onChange={e => void patch({ status: e.target.value })}>{LEAD_STATUSES.map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label><label>Notes<textarea value={note} onChange={e => setNote(e.target.value)} rows={7} placeholder="Add a private follow-up note…" /></label><button className="button button-small" disabled={saving} onClick={() => void patch({ notes: note })}><Save size={14}/>{saving ? "Saving…" : "Save note"}</button></aside></div></main></div>;
}
