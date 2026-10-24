"use client";
import { useState } from "react";
import { ArrowUpRight, Download, Globe2, LoaderCircle, Sparkles } from "lucide-react";
import type { SearchResult } from "@/lib/validation";
import { api, safeExternalUrl } from "./api-client";
import { resultsCsv } from "@/lib/search-export";

export default function SearchResults({ results, warnings, query }: { results: SearchResult[]; warnings: string[]; query: string }) {
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const pageCount = Math.max(1, Math.ceil(results.length / 20));
  const current = Math.min(page, pageCount);
  function exportCsv() {
    const url = URL.createObjectURL(new Blob(["\uFEFF", resultsCsv(results)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `reachflow-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function prepare(result: SearchResult, action: "save" | "prepare") {
    setPending(`${action}:${result.id}`); setFeedback("");
    try { const data = await api<{ id?: string }>("/api/jobs/from-result", { action, result: { title: result.title, description: result.description || "No excerpt supplied; review the original source before saving.", url: result.url, source: result.source } }); if (action === "prepare" && data.id) window.location.assign(`/applications/${encodeURIComponent(data.id)}`); else setFeedback("Saved to your applications."); }
    catch (err) { setFeedback(err instanceof Error ? err.message : "This role could not be saved."); }
    finally { setPending(null); }
  }
  return <section aria-live="polite">
    <div className="results-heading"><div><h2>Your discoveries <span>{results.length}</span></h2><p>Results for “{query}”</p></div><button className="button button-outline button-small" disabled={!results.length} onClick={exportCsv}><Download size={15}/>Export all {results.length}</button></div>
     <p className="muted small">Newest published sources first, then older sources. Undated sources appear last. Publication dates do not confirm that a job or opportunity is still available.</p>{feedback && <div className="notice notice-success" role="status">{feedback}</div>}
    {warnings.length > 0 && <details className="coverage-notes"><summary>Source coverage and result limits</summary>{warnings.map(warning => <p key={warning}>{warning}</p>)}</details>}
    {results.length ? <div className="real-results">{results.slice((current - 1) * 20, current * 20).map(result => {
      const url = safeExternalUrl(result.url);
      return <article className="result-card" key={`${result.id}-${result.url}`}>
        <div className="result-icon"><Globe2 size={21}/></div><div className="result-body"><span className="card-source">{result.source}</span>
          <h3>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{result.title}<ArrowUpRight size={17}/></a> : result.title}</h3>
          <p>{result.description || "No excerpt was supplied by the source. Open the original page for details."}</p>
           <div className="result-meta">{result.publishedAt ? <>Published <time dateTime={result.publishedAt}>{new Date(result.publishedAt).toLocaleString()}</time></> : "Publication date unavailable"}{result.author && <span> · Author: {result.author}</span>}</div><div className="result-actions"><button className="button button-outline button-small" disabled={!!pending} onClick={() => prepare(result, "save")}>{pending === `save:${result.id}` ? <LoaderCircle className="spin" size={14}/> : null}Save role</button><button className="button button-small" disabled={!!pending} onClick={() => prepare(result, "prepare")}><Sparkles size={14}/>{pending === `prepare:${result.id}` ? "Preparing…" : "Prepare application"}</button></div>
          {result.content && <details className="source-details"><summary>Expanded source excerpt</summary><p>{result.content}</p><small>Provider-supplied text, up to 6,000 characters. Not a verified full profile or contact record.</small></details>}
          {url && <a className="result-url" href={url} target="_blank" rel="noopener noreferrer">Open original source <ArrowUpRight size={12}/></a>}
        </div>
      </article>;
    })}</div> : <div className="empty-state"><h2>No matching sources.</h2><p>Broaden the query or loosen your filters. No results are invented.</p></div>}
    {pageCount > 1 && <nav className="results-pagination" aria-label="Result pages"><button className="button button-outline button-small" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button><span>Page {current} of {pageCount} · {results.length} sources</span><button className="button button-outline button-small" disabled={current === pageCount} onClick={() => setPage(current + 1)}>Next</button></nav>}
  </section>;
}
