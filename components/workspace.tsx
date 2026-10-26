"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, Building2, ClipboardList, CreditCard, FlaskConical, History, Home, LoaderCircle, LogOut, Rocket, Search, Send, Settings2, Sparkles, UserRound, Users, X } from "lucide-react";
import { Brand } from "./brand";
import { api, safeExternalUrl } from "./api-client";
import SearchControls from "./search-controls";
import SearchResults from "./search-results";
import { authorizeSearch, searchFiltersSchema, type SearchFilters } from "@/lib/search-options";
import type { SearchResult } from "@/lib/validation";
import type { ConnectorCapability } from "@/lib/connectors";
import AiSettings from "./ai-settings";

type Kind = "jobs" | "clients" | "research";
type Run = { id: string; query: string; kind: Kind; created_at: string; result_count: number; search_filters?: SearchFilters; requested_limit?: number };
type Status = { configured: boolean; auth: boolean; search: boolean; billing: boolean };
type Session = { user: { email: string } | null; plan: string; profileReady?: boolean; setupMessage?: string };
const kinds = [
  { value: "jobs" as Kind, title: "Find jobs", icon: BriefcaseBusiness },
  { value: "clients" as Kind, title: "Find clients", icon: Users },
  { value: "research" as Kind, title: "Explore ideas", icon: FlaskConical },
];
const suggestions: Record<Kind, string[]> = {
  jobs: ["Remote product design roles", "Climate tech engineering jobs", "Early-stage marketing roles"],
  clients: ["Founders looking for a web designer", "Small businesses needing SEO help", "Startups seeking brand strategy"],
  research: ["Local-first software", "The future of sustainable packaging", "Open source AI tools"],
};

export default function Workspace() {
  const [kind, setKind] = useState<Kind>("jobs");
  const [view, setView] = useState<"search" | "history" | "settings">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [resultLimit, setResultLimit] = useState(10);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState("");
  const [initializing, setInitializing] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [error, setError] = useState("");
  const [setupError, setSetupError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [connectors, setConnectors] = useState<ConnectorCapability[]>([]);
  const paid = plan === "starter" || plan === "pro";
  const maximum = plan === "pro" ? 100 : plan === "starter" ? 50 : 10;

  async function loadHistory() {
    setHistoryLoading(true); setHistoryError("");
    try { setRuns((await api<{ runs: Run[] }>("/api/runs")).runs); }
    catch (err) { setHistoryError(err instanceof Error ? err.message : "Search history could not be loaded."); }
    finally { setHistoryLoading(false); }
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("kind");
    if (requested === "jobs" || requested === "clients" || requested === "research") setKind(requested);
    if (params.get("query")) setQuery(params.get("query")!.slice(0, 500));
    let active = true;
    Promise.allSettled([api<Status>("/api/status"), api<Session>("/api/session"), api<{ connectors: ConnectorCapability[] }>("/api/connectors")]).then(([configuration, session, catalog]) => {
      if (!active) return;
      if (configuration.status === "fulfilled") setStatus(configuration.value);
      else setSetupError("Workspace availability could not be loaded. Refresh the page to retry.");
      if (session.status === "fulfilled") {
        setEmail(session.value.user?.email ?? null); setPlan(session.value.plan);
        setProfileReady(!!session.value.user && session.value.profileReady !== false);
        setResultLimit(authorizeSearch(session.value.plan, {}).limit);
        if (session.value.setupMessage) setSetupError(session.value.setupMessage);
        if (session.value.user && session.value.profileReady !== false) void loadHistory();
      } else setSetupError(session.reason instanceof Error ? session.reason.message : "Your session could not be loaded.");
      if (catalog.status === "fulfilled") setConnectors(catalog.value.connectors);
      setInitializing(false);
    });
    return () => { active = false; };
  }, []);
  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (query.trim().length < 3 || searching) return;
    const checked = searchFiltersSchema.safeParse(filters);
    if (!checked.success) { setError(checked.error.issues[0].message); return; }
    // Client validation is usability only; API + atomic SQL independently enforce the plan.
    const submittedQuery = query.trim();
    setSearching(true); setError(""); setWarnings([]); setSearched(false); setResults([]);
    try {
      const data = await api<{ results: SearchResult[]; warnings?: string[] }>("/api/search", { query: submittedQuery, kind, limit: resultLimit, filters: checked.data });
      setResults(data.results); setWarnings(data.warnings ?? []); setLastQuery(submittedQuery); setSearched(true); void loadHistory();
    } catch (err) { setError(err instanceof Error ? err.message : "Search failed. Please try again."); }
    finally { setSearching(false); }
  }
  async function billing() {
    setActionPending(true); setError("");
    try { const data = await api<{ url: string }>("/api/billing/portal", {}); const url = safeExternalUrl(data.url); if (!url) throw new Error("The billing portal is unavailable."); window.location.assign(url); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to open billing."); }
    finally { setActionPending(false); }
  }
  async function logout() {
    setActionPending(true); setError("");
    try { await api("/api/auth", { action: "logout" }); window.location.replace("/login"); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to sign out."); setActionPending(false); }
  }
  function chooseKind(next: Kind) { setKind(next); setView("search"); setSearched(false); setResults([]); setWarnings([]); setError(""); }
  function revisit(run: Run) {
    const stored = searchFiltersSchema.safeParse(run.search_filters ?? {});
    setFilters(paid && stored.success ? stored.data : {});
    setResultLimit(Math.min(run.requested_limit ?? 10, maximum));
    setQuery(run.query); chooseKind(run.kind);
  }

  return <div className="workspace">
    <aside className="workspace-sidebar">
      <Brand/><div className="workspace-label">YOUR WORKSPACE</div>
      <nav aria-label="Workspace navigation">
        {kinds.map(({ value, title, icon: Icon }) => <button key={value} disabled={searching} className={`sidebar-link ${view === "search" && kind === value ? "active" : ""}`} onClick={() => chooseKind(value)}><Icon size={18}/>{title}</button>)}
        <span className="sidebar-divider"/>
         <button className={`sidebar-link ${view === "history" ? "active" : ""}`} onClick={() => setView("history")}><History size={18}/>Search history</button>
          <Link className="sidebar-link" href="/leads"><Users size={18}/>Leads</Link><Link className="sidebar-link" href="/outreach"><Send size={18}/>Outreach agent</Link><span className="sidebar-divider"/><Link className="sidebar-link" href="/homes"><Home size={18}/>Ahmedabad homes</Link><Link className="sidebar-link" href="/jobs"><BriefcaseBusiness size={18}/>Verified jobs</Link><Link className="sidebar-link" href="/employer"><Building2 size={18}/>Employer portal</Link><Link className="sidebar-link" href="/job-hunt"><Rocket size={18}/>7-day job sprint</Link><Link className="sidebar-link" href="/applications"><ClipboardList size={18}/>Applications</Link><Link className="sidebar-link" href="/dashboard/affiliate"><Users size={18}/>Referrals</Link>
         <Link className="sidebar-link" href="/profile"><UserRound size={18}/>Your profile</Link>
         <button className={`sidebar-link ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}><Settings2 size={18}/>Workspace settings</button>
      </nav>
      <div className="sidebar-upgrade"><Sparkles size={20}/><h3>Room for more.</h3><p>Free: 10 · Starter: 50 · Pro: 100 sources per search, when available.</p><Link href="/pricing">Explore plans <ArrowUpRight size={15}/></Link></div>
      <div className="workspace-account"><Link href={email ? "/profile" : "/login"} className="workspace-account-profile" aria-label={email ? "Open your profile" : "Sign in"}><span className="avatar">{email ? email[0].toUpperCase() : "?"}</span><div><strong>{email ?? "Your workspace"}</strong><small>{email ? `${plan || "Account"} plan` : "Sign in to get started"}</small></div></Link>{email && <button className="icon-button" aria-label="Sign out" disabled={actionPending} onClick={logout}><LogOut size={16}/></button>}</div>
    </aside>
    <div className="workspace-main">
      <header className="workspace-topbar"><span>Workspace <strong>{view === "history" ? "Search history" : view === "settings" ? "Settings" : kinds.find(k => k.value === kind)?.title}</strong></span><Link href="/">Back to website <ArrowUpRight size={14}/></Link></header>
      <main id="main" className="workspace-content">
        {initializing ? <div className="loading-state" role="status"><LoaderCircle className="spin"/>Opening your workspace…</div> : <>
          {setupError && <div className="notice notice-error" role="alert">{setupError}</div>}
          {status && !status.search && <div className="notice notice-config"><Settings2 size={18}/><div><strong>Search setup is incomplete.</strong><p>Check server-only Supabase credentials and search-provider configuration, then restart ReachFlow. Do not share secrets in chat.</p></div></div>}
          {!email && <div className="notice notice-config"><p><Link href="/login">Sign in</Link> or <Link href="/signup">create an account</Link> to search.</p></div>}
          {error && <div className="notice notice-error" role="alert">{error}<button className="icon-button" aria-label="Dismiss error" onClick={() => setError("")}><X size={16}/></button></div>}
          {view === "search" && <>
            <div className="workspace-intro"><span className="eyebrow">FOLLOW YOUR CURIOSITY</span><h1>{kind === "jobs" ? "Your next role is out there." : kind === "clients" ? "Find your next conversation." : "Make space for a new idea."}</h1><p>Search public sources, follow original links, and keep your discoveries together.</p></div>
            <section className="search-panel">
              <form onSubmit={search}>
                <label htmlFor="search-query">What are you looking for?</label>
                <div className="workspace-search"><Search size={20}/><input id="search-query" value={query} onChange={event => setQuery(event.target.value)} placeholder={suggestions[kind][0]} minLength={3} maxLength={500} required disabled={searching}/><button className="button" disabled={searching || query.trim().length < 3 || !email || !status?.search || !profileReady}>{searching ? <><LoaderCircle className="spin" size={17}/>Searching</> : <>Discover <ArrowRight size={17}/></>}</button></div>
              </form>
              <fieldset className="search-options-fieldset" disabled={searching}>
                <legend className="sr-only">Search options</legend>
                <div className="search-options-row"><SearchControls paid={paid} filters={filters} onChange={setFilters}/><label className="result-limit">Up to<select value={resultLimit} onChange={event => setResultLimit(Number(event.target.value))} disabled={!paid}>{[10, 25, 50, 100].filter(value => value <= maximum).map(value => <option key={value} value={value}>{value} sources</option>)}</select></label></div>
              </fieldset>
              <p className="filter-help">{paid ? `${plan === "pro" ? "Pro" : "Starter"}: up to ${maximum} unique sources per search, with expanded excerpts and filters.` : <>Free: up to 10 sources per search. <Link href="/pricing">Upgrade for larger searches and filters.</Link></>} Actual matches vary; a search request is not a guaranteed result count.</p>
              <div className="suggestions"><span>TRY A LITTLE INSPIRATION</span>{suggestions[kind].map(suggestion => <button type="button" disabled={searching} key={suggestion} onClick={() => setQuery(suggestion)}>{suggestion}<ArrowUpRight size={12}/></button>)}</div>
            </section>
            {searching ? <div className="search-loading" role="status"><LoaderCircle className="spin"/><h2>Following the possibilities…</h2><p>Searching supported public sources. Larger searches may take longer.</p><div className="skeleton-row"/><div className="skeleton-row"/></div>
              : searched ? <SearchResults key={lastQuery} results={results} warnings={warnings} query={lastQuery}/>
              : <div className="empty-state initial-empty"><div className="empty-illustration"><span/><Search size={34}/><i>✳</i></div><h2>Good things start with a question.</h2><p>Tell us what you’re looking for. Your source-linked discoveries will appear here.</p><span className="empty-note">Public-source search, not private account scraping.</span></div>}
          </>}
          {view === "history" && <>
            <div className="workspace-intro"><span className="eyebrow">PICK UP THE THREAD</span><h1>Your search history.</h1><p>Revisit a query and its saved filters. Running it again uses another search attempt.</p></div>
            <div className="results-heading"><h2>Past searches</h2><button className="button button-outline button-small" onClick={loadHistory} disabled={historyLoading || !email || !profileReady}>{historyLoading ? "Refreshing…" : "Refresh"}</button></div>
            {historyError && <div className="notice notice-error" role="alert">{historyError}</div>}
            {historyLoading ? <div className="loading-state" role="status"><LoaderCircle className="spin"/>Loading history…</div> : runs.length ? <div className="history-list">{runs.map(run => <button className="history-row" key={run.id} disabled={searching} onClick={() => revisit(run)}><History size={18}/><span><strong>{run.query}</strong><small>{run.kind} · {new Date(run.created_at).toLocaleString()} · {run.result_count} results at the time</small></span><span className="history-revisit">Revisit query <ArrowRight size={15}/></span></button>)}</div> : !historyError && <div className="empty-state"><History size={32}/><h2>A fresh page.</h2><p>Your searches will be saved here.</p><button className="button button-small" onClick={() => setView("search")}>Start exploring</button></div>}
          </>}
          {view === "settings" && <>
            <div className="workspace-intro"><span className="eyebrow">MAKE YOURSELF AT HOME</span><h1>Workspace settings.</h1><p>Your account, plan, and connections.</p></div>
             <section className="settings-card"><h2>Account & billing</h2><div className="settings-row"><span>Email</span><strong>{email ?? "Not signed in"}</strong></div><div className="settings-row"><span>Plan</span><strong>{plan || "Unavailable"}</strong></div><div className="settings-row"><span>Maximum sources per search</span><strong>Up to {maximum}</strong></div><div className="settings-buttons"><button className="button button-small" disabled={actionPending || !email || !status?.billing} onClick={billing}>{actionPending ? <LoaderCircle className="spin" size={16}/> : <CreditCard size={16}/>}Manage billing</button><Link href="/pricing" className="button button-outline button-small">View plans</Link></div>{!status?.billing && <p className="muted small">Stripe billing is not configured for this deployment yet.</p>}</section>
             <AiSettings />
             <section className="settings-card"><h2>Service configuration</h2>{([["Authentication", status?.auth], ["Search + storage", status?.search], ["Billing", status?.billing]] as const).map(([label, configured]) => <div className="settings-row" key={label}><span>{label}</span><span className={`service-badge ${configured ? "ready" : ""}`}>{configured ? "Configured" : status ? "Needs setup" : "Unknown"}</span></div>)}<p className="muted small">Configuration flags do not prove live connectivity or that every database migration is applied.</p></section>
            <section className="settings-card"><h2>Social-source coverage</h2><p className="muted small">Paid filters can target indexed public pages on Reddit, LinkedIn, YouTube, X, Facebook, Instagram, TikTok, and GitHub. Coverage is controlled by the search provider. No authenticated platform-specific scrapers are connected; private posts and messages are not accessed.</p></section>
            <section className="settings-card connector-catalog"><h2>Connector capability</h2>{connectors.map(connector => <div className="connector-row" key={connector.id}><div><strong>{connector.label}</strong><small>{connector.coverage}</small></div><span className={`service-badge ${connector.available ? "ready" : ""}`}>{connector.available ? "Available" : connector.mode === "authorized" ? "User setup required" : "Not enabled"}</span></div>)}</section>
          </>}
        </>}
      </main>
      <footer className="workspace-footer"><span>Keep looking. Something good is out there.</span><span>reachflow.</span></footer>
    </div>
  </div>;
}
