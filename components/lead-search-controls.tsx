"use client";
import { Search, SlidersHorizontal } from "lucide-react";
import type { LeadSearchInput } from "@/lib/lead-workflow";

type Props = { value: LeadSearchInput; onChange: (value: LeadSearchInput) => void; onSubmit: () => void; pending?: boolean };
const sources = ["Google Maps", "LinkedIn", "Reddit", "Directories", "Company websites"];

export default function LeadSearchControls({ value, onChange, onSubmit, pending }: Props) {
  const set = (key: keyof LeadSearchInput, next: string) => onChange({ ...value, [key]: next || undefined });
  return <form className="lead-search-card" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
    <div className="lead-search-heading"><div><span className="eyebrow">PUBLIC BUSINESS RESEARCH</span><h2>Find businesses worth a conversation.</h2><p>Describe who you help and where they operate. ReachFlow searches supported public sources and links every result back to its source.</p></div><SlidersHorizontal size={21}/></div>
    <div className="lead-form-grid">
      <label>What niche do you serve? *<input required maxLength={160} value={value.niche} onChange={e => set("niche", e.target.value)} placeholder="e.g. independent restaurants" /></label>
      <label>Location or market<input maxLength={100} value={value.location ?? ""} onChange={e => set("location", e.target.value)} placeholder="e.g. Austin, Texas" /></label>
      <label>Country<input maxLength={2} value={value.country ?? ""} onChange={e => onChange({ ...value, country: e.target.value.toUpperCase() || undefined })} placeholder="US" /></label>
      <label>Business type<input maxLength={100} value={value.businessType ?? ""} onChange={e => set("businessType", e.target.value)} placeholder="e.g. boutique agency" /></label>
      <label className="lead-form-wide">Need or problem signal<input maxLength={180} value={value.need ?? ""} onChange={e => set("need", e.target.value)} placeholder="e.g. outdated website, hiring a marketer" /></label>
      <label>Contact preference<select value={value.contactPreference ?? "any"} onChange={e => onChange({ ...value, contactPreference: e.target.value as LeadSearchInput["contactPreference"] })}><option value="any">Any public contact</option><option value="email">Public email</option><option value="phone">Public phone</option><option value="website">Website</option></select></label>
    </div>
    <fieldset className="lead-sources"><legend>Sources to prioritize</legend>{sources.map(source => <label key={source}><input type="checkbox" checked={value.sources?.includes(source) ?? false} onChange={e => onChange({ ...value, sources: e.target.checked ? [...(value.sources ?? []), source] : (value.sources ?? []).filter(item => item !== source) })}/>{source}</label>)}</fieldset>
    <div className="lead-search-actions"><p><strong>Public business data only.</strong> No private profiles, messages, or guaranteed buying intent.</p><button className="button" disabled={pending || value.niche.trim().length < 3}><Search size={16}/>{pending ? "Searching public sources…" : "Find leads"}</button></div>
  </form>;
}
