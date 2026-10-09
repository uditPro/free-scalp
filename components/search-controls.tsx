"use client";
import { useState } from "react";
import { ChevronDown, Filter, LockKeyhole, X } from "lucide-react";
import { SOCIAL_SOURCES, type SearchFilters, type SocialSource } from "@/lib/search-options";

type Props = { paid: boolean; filters: SearchFilters; onChange: (filters: SearchFilters) => void };
export function localDateValue(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export default function SearchControls({ paid, filters, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [include, setInclude] = useState("");
  const [exclude, setExclude] = useState("");
  function add(key: "includeDomains" | "excludeDomains", value: string) {
    const domain = value.trim().toLowerCase();
    if (!domain || (filters[key] ?? []).includes(domain) || (filters[key]?.length ?? 0) >= 20) return;
    onChange({ ...filters, [key]: [...(filters[key] ?? []), domain] });
    key === "includeDomains" ? setInclude("") : setExclude("");
  }
  function dateChange(key: "publishedAfter" | "publishedBefore", value: string) {
    if (!value) { onChange({ ...filters, [key]: undefined }); return; }
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) onChange({ ...filters, [key]: date.toISOString() });
  }
  return <div className="search-controls">
    <button type="button" className="filter-toggle" aria-expanded={open} aria-controls="advanced-search-filters" onClick={() => setOpen(value => !value)}><Filter size={14}/> Advanced filters {!paid && <LockKeyhole size={12}/>}<ChevronDown size={14}/></button>
    {open && <div className="filter-panel" id="advanced-search-filters">
      {!paid && <p className="filter-locked"><LockKeyhole size={14}/> Date, location, source, and website filters require Starter or Pro.</p>}
      <fieldset disabled={!paid}>
        <legend>Published date and time</legend>
        <div className="filter-grid">
          <label>Published after<input type="datetime-local" value={localDateValue(filters.publishedAfter)} onChange={event => dateChange("publishedAfter", event.target.value)}/></label>
          <label>Published before<input type="datetime-local" value={localDateValue(filters.publishedBefore)} onChange={event => dateChange("publishedBefore", event.target.value)}/></label>
        </div>
        <p className="filter-help">Times use your device timezone and are sent as UTC. Undated sources are excluded when a date filter is set.</p>
        <div className="filter-grid">
          <label>Location preference<input value={filters.location ?? ""} maxLength={100} placeholder="e.g. Bengaluru, remote, Europe" onChange={event => onChange({ ...filters, location: event.target.value || undefined })}/></label>
          <label>Country code (optional)<input value={filters.country ?? ""} maxLength={2} placeholder="IN, US, GB…" onChange={event => onChange({ ...filters, country: event.target.value.toUpperCase() || undefined })}/></label>
        </div>
        <p className="filter-help">Location influences relevance; it is not verified job location or work eligibility.</p>
        {(["includeDomains", "excludeDomains"] as const).map(key => {
          const value = key === "includeDomains" ? include : exclude;
          return <div key={key}>
            <div className="filter-domain-row"><label>{key === "includeDomains" ? "Allow website" : "Block website"}<input value={value} maxLength={253} placeholder={key === "includeDomains" ? "reddit.com" : "example.com"} onChange={event => key === "includeDomains" ? setInclude(event.target.value) : setExclude(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); add(key, value); } }}/></label><button type="button" className="domain-add" onClick={() => add(key, value)}>Add</button></div>
            <div className="filter-chips">{(filters[key] ?? []).map(domain => <button type="button" key={domain} aria-label={`Remove ${domain} from ${key === "includeDomains" ? "allow" : "block"} list`} onClick={() => onChange({ ...filters, [key]: (filters[key] ?? []).filter(item => item !== domain) })}>{domain}<X size={11}/></button>)}</div>
          </div>;
        })}
        <p className="filter-help">Add hostnames, not URLs or paths (maximum 20 per list). Subdomains are included. Block rules take priority.</p>
        <div className="source-checks"><span>Public indexed social sources</span>{(Object.keys(SOCIAL_SOURCES) as SocialSource[]).map(value => <label key={value}><input type="checkbox" checked={filters.sources?.includes(value) ?? false} onChange={event => onChange({ ...filters, sources: event.target.checked ? [...(filters.sources ?? []), value] : (filters.sources ?? []).filter(item => item !== value) })}/>{SOCIAL_SOURCES[value].label}</label>)}</div>
        <p className="filter-help">Selected platforms and allowed websites are combined. No private accounts, login-only posts, direct messages, or authenticated scraping are connected.</p>
        <button type="button" className="text-button" onClick={() => { onChange({}); setInclude(""); setExclude(""); }}>Clear filters</button>
      </fieldset>
    </div>}
  </div>;
}
