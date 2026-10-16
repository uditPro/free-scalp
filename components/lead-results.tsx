"use client";
import Link from "next/link";
import { ArrowUpRight, Check, ExternalLink, Save } from "lucide-react";
import { safeExternalUrl } from "./api-client";

export type Lead = { id: string; business_name: string; domain: string; source_url: string; description: string; location?: string | null; contact_name?: string | null; contact_role?: string | null; industry?: string | null; need_signal?: string | null; public_contacts?: { emails?: string[]; phones?: string[]; website?: string }; score: number; score_explanation?: { components?: Record<string, number>; method?: string }; status: string; updated_at: string; notes?: string };
const unavailable = (field: string) => `Unavailable — not found in the public source${field ? ` for ${field.toLowerCase()}` : ""}.`;
const quality = (score: number) => score >= 75 ? "High quality match" : score >= 50 ? "Moderate quality match" : "Low quality match";

export default function LeadResults({ leads, warnings, onRefresh }: { leads: Lead[]; warnings?: string[]; onRefresh?: () => void }) {
  return <section className="lead-results" aria-live="polite">
    <div className="results-heading"><div><span className="eyebrow">YOUR SHORTLIST</span><h2>Potential clients <span>{leads.length}</span></h2></div><Link className="button button-outline button-small" href="/leads/pipeline">Open pipeline <ArrowUpRight size={14}/></Link></div>
    <p className="lead-disclosure">Client metadata first: public business name, contact, email, phone, location, and need signal. Websites are secondary source verification only.</p>
    {warnings?.map(warning => <div className="notice notice-config" key={warning}>{warning}</div>)}
    {leads.length ? <div className="lead-result-list">{leads.map(lead => { const source = safeExternalUrl(lead.source_url); const contacts = lead.public_contacts ?? {}; const components = lead.score_explanation?.components ?? {}; return <article className="lead-result-card" key={lead.id}>
      <div className="lead-score"><strong>{lead.score}</strong><span>fit score</span></div>
      <div className="lead-result-body"><div className="lead-card-top"><div><span className="card-source">{lead.industry || "Business lead"}</span><h3>{lead.business_name}</h3></div><span className={`lead-status status-${lead.status}`}>{lead.status.replaceAll("_", " ")}</span></div>
        <div className="lead-data-grid"><div><small>Contact person / role</small><strong>{lead.contact_name || unavailable("contact person")}<br />{lead.contact_role || unavailable("contact role")}</strong></div><div><small>Email</small>{contacts.emails?.[0] ? <a href={`mailto:${contacts.emails[0]}`}>{contacts.emails[0]}</a> : <strong>{unavailable("email")}</strong>}</div><div><small>Phone</small>{contacts.phones?.[0] ? <a href={`tel:${contacts.phones[0]}`}>{contacts.phones[0]}</a> : <strong>{unavailable("phone")}</strong>}</div><div><small>Location</small><strong>{lead.location || unavailable("location")}</strong></div><div><small>Industry</small><strong>{lead.industry || unavailable("industry")}</strong></div><div><small>Need signal</small><strong>{lead.need_signal || unavailable("need signal")}</strong></div></div>
         <div className="lead-quality"><span><small>Confidence / quality</small><strong>{quality(lead.score)}</strong></span><span><small>Evidence</small><strong>{source ? "Public source available" : unavailable("source")}</strong></span></div>
         <div className="lead-meta"><span>Checked {new Date(lead.updated_at).toLocaleDateString()}</span></div>
         {lead.description && <details className="lead-evidence"><summary>View raw provider excerpt</summary><p>{lead.description}</p></details>}
        <details className="score-breakdown"><summary>Why this lead scored {lead.score}</summary><div>{Object.entries(components).map(([key, score]) => <span key={key}><b>{score}</b> {key}</span>)}</div><small>Deterministic relevance matching; no buying intent or contact details are inferred.</small></details>
         <div className="result-actions"><Link className="button button-outline button-small" href={source || `/leads/${lead.id}`} target={source ? "_blank" : undefined} rel={source ? "noopener noreferrer" : undefined}><ExternalLink size={14}/>Verify source</Link><Link className="button button-small" href={`/leads/${lead.id}`}><Save size={14}/>Review metadata</Link><span className="saved-note"><Check size={14}/>Saved to pipeline</span></div>
      </div></article>; })}</div> : <div className="empty-state"><h2>No public businesses matched.</h2><p>Try a broader niche or location. ReachFlow never invents records.</p>{onRefresh && <button className="button button-outline" onClick={onRefresh}>Try again</button>}</div>}
  </section>;
}
