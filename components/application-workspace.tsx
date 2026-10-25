"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, ClipboardList, FileText, LoaderCircle, Mail, Save, Send, Sparkles } from "lucide-react";
import { api, safeExternalUrl } from "@/components/api-client";
import JobFit, { FitData } from "./job-fit";

type AppDetail = {
  id: string;
  title?: string;
  company?: string;
  status?: string;
  url?: string;
  description?: string;
  job?: { title?: string; company?: string; url?: string; description?: string; source?: string; source_type?: string; integrity_status?: string; fetched_at?: string; posted_at?: string };
  fit?: FitData;
  draftMode?: string;
  tailored_resume?: string;
  cover_letter?: string;
  interview_prep?: string[];
  draftReview?: { status?: string; unsupportedClaims?: string[]; missingEvidence?: string[] };
};

const statuses = [
  { value: "draft", label: "Saved" },
  { value: "ready", label: "Ready to apply" },
  { value: "submitted", label: "Applied" },
  { value: "interviewing", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "withdrawn", label: "Closed" },
  { value: "rejected", label: "Closed — not moving forward" },
];

export default function ApplicationWorkspace({ id }: { id: string }) {
  const [item, setItem] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState("resume");

  async function load() {
    setLoading(true);
    setError("");
    try { setItem(await api<AppDetail>(`/api/applications/${encodeURIComponent(id)}`)); }
    catch (err) { setError(err instanceof Error ? err.message : "Application could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [id]);

  async function updateStatus(status: string) {
    setPending(true); setError("");
    try {
      const data = await api<{ application: AppDetail }>(`/api/applications/${encodeURIComponent(id)}`, { status }, { method: "PATCH" });
      setItem(current => current ? { ...current, ...data.application, status } : current);
    } catch (err) { setError(err instanceof Error ? err.message : "Status could not be updated."); }
    finally { setPending(false); }
  }

  async function generateDrafts() {
    setGenerating(true); setError("");
    try {
      await api(`/api/applications/${encodeURIComponent(id)}/generate`, {}, { method: "POST" });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Drafts could not be generated."); }
    finally { setGenerating(false); }
  }

  if (loading) return <div className="career-loading" role="status"><LoaderCircle className="spin"/>Opening application workspace…</div>;
  if (error || !item) return <div className="notice notice-error" role="alert">{error || "This application is unavailable."}</div>;

  const title = item.title || item.job?.title || "Untitled role";
  const company = item.company || item.job?.company || "Company not listed";
  const sourceUrl = safeExternalUrl(item.url || item.job?.url || "");
  const copy = tab === "resume" ? item.tailored_resume : tab === "letter" ? item.cover_letter : (item.interview_prep || []).join("\n\n");
  const currentStatus = statuses.find(status => status.value === item.status)?.value || "draft";
  const statusLabel = statuses.find(status => status.value === item.status)?.label || "Saved";
  const hasDrafts = Boolean(item.tailored_resume || item.cover_letter || item.interview_prep?.length);

  return <div className="application-layout">
    <div className="application-main">
      <Link href="/applications" className="back-link"><ArrowLeft size={15}/>All applications</Link>
      <div className="application-heading"><div><span className="eyebrow">APPLICATION WORKSPACE</span><h1>{title}</h1><p>{company}{sourceUrl && <> · <a href={sourceUrl} target="_blank" rel="noreferrer">Open original role</a></>}</p></div><span className="status-pill large">{statusLabel}</span></div>
      <JobFit fit={item.fit}/>
      <section className="career-card draft-card">
        <div className="draft-card-heading"><div><span className="eyebrow">EDIT BEFORE YOU SEND</span><h2>Your application drafts</h2></div><button className="button button-small" disabled={generating} onClick={generateDrafts}>{generating ? <LoaderCircle className="spin" size={15}/> : <Sparkles size={15}/>} {hasDrafts ? "Regenerate drafts" : "Generate drafts"}</button></div>
        <div className="draft-tabs" role="tablist" aria-label="Application drafts"><button className={tab === "resume" ? "active" : ""} onClick={() => setTab("resume")}><FileText size={16}/>Tailored resume</button><button className={tab === "letter" ? "active" : ""} onClick={() => setTab("letter")}><Mail size={16}/>Cover letter</button><button className={tab === "prep" ? "active" : ""} onClick={() => setTab("prep")}><ClipboardList size={16}/>Interview prep</button></div>
       <div className="draft-label"><span>{item.draftMode ? `${item.draftMode.toUpperCase()} DRAFT` : "DRAFT NOT GENERATED"}</span><button className="text-button" disabled={!copy} onClick={() => navigator.clipboard?.writeText(copy || "")}><Save size={14}/>Copy text</button></div>
         {item.draftReview && <div className={`notice ${item.draftReview.status === "ready" ? "notice-success" : "notice-config"}`}><strong>{item.draftReview.status === "ready" ? "Evidence review passed" : "Review before sending"}</strong>{item.draftReview.missingEvidence?.map(note => <p key={note}>{note}</p>)}{item.draftReview.unsupportedClaims?.map(claim => <p key={claim}>Check this claim: “{claim}”</p>)}</div>}
         {copy ? <pre className="draft-content">{copy}</pre> : <div className="draft-empty">Save your profile, then generate editable drafts from the job details and your own experience.</div>}
      </section>
    </div>
    <aside className="application-side">
      <section className="career-card"><span className="eyebrow">NEXT STEP</span><h2>Move it forward</h2><p className="muted small">Status is a private organizing tool. ReachFlow never submits an application for you.</p><label className="status-label">Status<select value={currentStatus} disabled={pending} onChange={e => updateStatus(e.target.value)}>{statuses.map(status => <option value={status.value} key={status.value}>{status.label}</option>)}</select></label><button className="button full-width" disabled={pending || currentStatus === "submitted"} onClick={() => updateStatus("submitted")}>{pending ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>}Mark as applied</button></section>
       <section className="career-card role-summary"><span className="eyebrow">ROLE NOTES</span><h2>Job details</h2><p>{item.description || item.job?.description || "No job description was supplied."}</p><div className="listing-evidence"><div><small>Source</small><strong>{item.job?.source || "Public search source"}</strong></div><div><small>Posting integrity</small><strong>{item.job?.integrity_status === "review" ? "Review flagged" : "No flags detected"}</strong></div><div><small>Fetched</small><strong>{item.job?.fetched_at ? new Date(item.job.fetched_at).toLocaleString() : "Not recorded"}</strong></div></div></section>
    </aside>
  </div>;
}
