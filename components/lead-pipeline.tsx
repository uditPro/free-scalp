"use client";
import Link from "next/link";
import { ArrowUpRight, Download, MapPin } from "lucide-react";
import type { Lead } from "./lead-results";
import { LEAD_STATUSES } from "@/lib/lead-workflow";

export default function LeadPipeline({ leads, onChange }: { leads: Lead[]; onChange: (status?: string) => void }) {
  async function exportCsv() {
    const response = await fetch('/api/leads?format=csv', { credentials: 'same-origin' });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reachflow-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="lead-pipeline"><div className="results-heading"><div><span className="eyebrow">LEAD PIPELINE</span><h1>Your saved businesses.</h1><p>Track public-source research without treating a fit score as intent.</p></div><button className="button button-outline button-small" onClick={() => void exportCsv()} disabled={!leads.length}><Download size={14}/>Export all leads CSV</button></div><div className="pipeline-filters"><button onClick={() => onChange()}>All <span>{leads.length}</span></button>{LEAD_STATUSES.map(status => { const count = leads.filter(lead => lead.status === status).length; return <button key={status} onClick={() => onChange(status)}>{status.replaceAll("_", " ")} <span>{count}</span></button>; })}</div><p className="lead-disclosure">Verify each source and contact before outreach. Only explicitly published business contact details are shown. CSV export includes every saved lead, not only this page.</p>{leads.length ? <div className="pipeline-list">{leads.map(lead => <article key={lead.id} className="pipeline-row"><div className="lead-score compact"><strong>{lead.score}</strong><span>fit</span></div><div className="pipeline-copy"><Link href={`/leads/${lead.id}`}><strong>{lead.business_name}</strong><ArrowUpRight size={14}/></Link><span>{lead.domain} · {lead.location ? <><MapPin size={12}/>{lead.location}</> : "Location unavailable"}</span></div><select value={lead.status} onChange={async event => { await fetch(`/api/leads/${lead.id}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: event.target.value }) }); onChange(); }} aria-label={`Status for ${lead.business_name}`}>{LEAD_STATUSES.map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></article>)}</div> : <div className="empty-state"><h2>Your pipeline is clear.</h2><p>Search for public businesses to save your first lead.</p><Link className="button button-small" href="/leads">Find leads</Link></div>}</section>;
}
