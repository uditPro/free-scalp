"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, Check, ExternalLink, FileText, LoaderCircle, MapPin, RefreshCw, ShieldCheck, Users, XCircle } from "lucide-react";
import { api, safeExternalUrl } from "@/components/api-client";

type Company = { id: string; name: string; website_url: string; website_domain: string; email_domain: string; description: string; verification_status: "pending" | "verified" | "rejected"; verification_reason: string; verified_at?: string | null };
type Job = { id: string; title: string; location: string; workplace_type: string; employment_type: string; experience_level: string; salary_min?: number | null; salary_max?: number | null; currency: string; description: string; requirements: string; status: "draft" | "published" | "closed"; published_at?: string | null; applicant_count?: number };
type EmployerApplication = { id: string; candidate_name: string; candidate_email: string; resume_text: string; cover_note: string; employer_note: string; status: "submitted" | "reviewing" | "interview" | "rejected" | "hired" | "withdrawn"; created_at: string; job?: { id: string; title: string } | null };
type JobForm = { title: string; location: string; workplace_type: "remote" | "hybrid" | "onsite"; employment_type: "full-time" | "part-time" | "contract" | "internship"; experience_level: "entry" | "mid" | "senior" | "lead"; salary_min: string; salary_max: string; currency: string; description: string; requirements: string };

const blankJob: JobForm = { title: "", location: "", workplace_type: "remote", employment_type: "full-time", experience_level: "mid", salary_min: "", salary_max: "", currency: "USD", description: "", requirements: "" };
const applicationStatuses = ["submitted", "reviewing", "interview", "rejected", "hired", "withdrawn"] as const;

function dateLabel(value: string | null | undefined) { return value ? new Date(value).toLocaleDateString() : "Not published"; }
function salaryLabel(job: Job) {
  if (job.salary_min != null && job.salary_max != null) return `${job.currency} ${job.salary_min.toLocaleString()}–${job.salary_max.toLocaleString()}`;
  if (job.salary_min != null) return `${job.currency} ${job.salary_min.toLocaleString()}+`;
  if (job.salary_max != null) return `Up to ${job.currency} ${job.salary_max.toLocaleString()}`;
  return "Salary not listed";
}

export default function EmployerPortal() {
  const [company, setCompany] = useState<Company | null>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [companyForm, setCompanyForm] = useState({ name: "", websiteUrl: "", description: "" });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<EmployerApplication[]>([]);
  const [jobForm, setJobForm] = useState<JobForm>(blankJob);
  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true); setError("");
    const [companyResult, jobsResult, applicationResult] = await Promise.allSettled([
      api<{ company: Company | null; accountEmail: string }>("/api/employer/company"),
      api<{ jobs: Job[] }>("/api/employer/jobs"),
      api<{ applications: EmployerApplication[] }>("/api/employer/applications"),
    ]);
    if (companyResult.status === "fulfilled") {
      setCompany(companyResult.value.company);
      setAccountEmail(companyResult.value.accountEmail);
      const stored = companyResult.value.company;
      if (stored) setCompanyForm({ name: stored.name, websiteUrl: stored.website_url, description: stored.description ?? "" });
    } else setError(companyResult.reason instanceof Error ? companyResult.reason.message : "Employer profile could not be loaded.");
    if (jobsResult.status === "fulfilled") setJobs(jobsResult.value.jobs ?? []);
    if (applicationResult.status === "fulfilled") setApplications(applicationResult.value.applications ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function saveCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSavingCompany(true); setError(""); setMessage("");
    try {
      const result = await api<{ company: Company; accountEmail: string }>("/api/employer/company", companyForm, { method: "PUT" });
      setCompany(result.company); setAccountEmail(result.accountEmail); setMessage(result.company.verification_status === "verified" ? "Company verified. You can now publish free jobs." : "Company details saved. Follow the verification guidance to unlock job posting.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Company details could not be saved."); }
    finally { setSavingCompany(false); }
  }

  async function createJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCreatingJob(true); setError(""); setMessage("");
    try {
      const payload = { ...jobForm, salary_min: jobForm.salary_min ? Number(jobForm.salary_min) : null, salary_max: jobForm.salary_max ? Number(jobForm.salary_max) : null };
      await api("/api/employer/jobs", payload);
      setJobForm(blankJob); setMessage("Job saved as a draft. Review it, then publish it to the free ReachFlow job board."); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "The job could not be saved."); }
    finally { setCreatingJob(false); }
  }

  async function jobAction(id: string, action: "publish" | "close" | "reopen") {
    setPendingId(id); setError(""); setMessage("");
    try { await api(`/api/employer/jobs/${encodeURIComponent(id)}`, { action }, { method: "PATCH" }); setMessage(action === "publish" || action === "reopen" ? "Job published on the ReachFlow job board." : "Job closed and removed from public listings."); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "The job status could not be updated."); }
    finally { setPendingId(null); }
  }

  async function updateApplication(id: string, status: string) {
    setPendingId(id); setError("");
    try { await api(`/api/employer/applications/${encodeURIComponent(id)}`, { status }, { method: "PATCH" }); setApplications(current => current.map(item => item.id === id ? { ...item, status: status as EmployerApplication["status"] } : item)); }
    catch (err) { setError(err instanceof Error ? err.message : "The applicant status could not be updated."); }
    finally { setPendingId(null); }
  }

  const verified = company?.verification_status === "verified";
  const website = safeExternalUrl(company?.website_url ?? "");
  const groupedApplications = useMemo(() => applications, [applications]);

  if (loading) return <div className="career-loading" role="status"><LoaderCircle className="spin"/>Opening your employer portal…</div>;

  return <div className="employer-portal">
    <div className="employer-hero"><div><span className="eyebrow">REACHFLOW FOR EMPLOYERS</span><h1>Meet people who are ready for the right <em>opportunity.</em></h1><p>Verified companies can post jobs for free, receive applications in one place, and keep candidates connected to a real company identity.</p></div><div className="employer-hero-card"><ShieldCheck size={22}/><strong>Free job posting</strong><span>Available after domain verification</span></div></div>
    {error && <div className="notice notice-error" role="alert">{error}{error.includes("sign in") && <> <Link href="/login?next=%2Femployer">Sign in</Link> to continue.</>}</div>}{message && <div className="notice notice-success" role="status"><Check size={16}/>{message}</div>}

    <section className="employer-grid">
      <form className="career-card employer-company-card" onSubmit={saveCompany}>
        <div className="card-heading"><div><span className="eyebrow">STEP 1 · VERIFY YOUR COMPANY</span><h2>Company profile</h2></div>{verified ? <span className="verification-badge verified"><BadgeCheck size={15}/>Verified</span> : <span className="verification-badge"><ShieldCheck size={15}/>Not verified</span>}</div>
        <p className="muted small">Use your work email <strong>{accountEmail || "account email"}</strong> and the matching public company website. We do not accept personal inboxes for free job posting.</p>
        <label>Company name<input required value={companyForm.name} onChange={event => setCompanyForm(current => ({ ...current, name: event.target.value }))} placeholder="Acme Technologies" maxLength={160}/></label>
        <label>Company website<input required type="url" value={companyForm.websiteUrl} onChange={event => setCompanyForm(current => ({ ...current, websiteUrl: event.target.value }))} placeholder="https://acme.com" maxLength={2048}/></label>
        <label>About the company<textarea rows={4} value={companyForm.description} onChange={event => setCompanyForm(current => ({ ...current, description: event.target.value }))} placeholder="What does your company build, and what kind of team are candidates joining?" maxLength={4000}/></label>
        {company && <div className={`verification-message ${verified ? "is-verified" : ""}`}><ShieldCheck size={17}/><div><strong>{verified ? "Your company is domain verified." : "Verification needed before posting."}</strong><p>{company.verification_reason}</p>{website && <a href={website} target="_blank" rel="noreferrer">Open company website <ExternalLink size={12}/></a>}</div></div>}
        <button className="button" disabled={savingCompany}>{savingCompany ? <LoaderCircle className="spin" size={16}/> : <RefreshCw size={16}/>} {savingCompany ? "Checking…" : "Save and check verification"}</button>
      </form>

      <section className="career-card employer-job-card">
        <div className="card-heading"><div><span className="eyebrow">STEP 2 · REACH CANDIDATES</span><h2>Post a free job</h2></div><BriefcaseBusiness size={20}/></div>
        {!verified ? <div className="employer-locked"><ShieldCheck size={24}/><div><strong>Verify your company first.</strong><p>Once your work email and website match, this form unlocks and your post can appear in the public job board.</p></div></div> : <form onSubmit={createJob}>
          <div className="form-grid"><label>Job title<input required value={jobForm.title} onChange={event => setJobForm(current => ({ ...current, title: event.target.value }))} placeholder="Senior Software Engineer" maxLength={180}/></label><label>Location<input required value={jobForm.location} onChange={event => setJobForm(current => ({ ...current, location: event.target.value }))} placeholder="Remote — United States" maxLength={180}/></label></div>
          <div className="form-grid"><label>Workplace<select value={jobForm.workplace_type} onChange={event => setJobForm(current => ({ ...current, workplace_type: event.target.value as JobForm["workplace_type"] }))}><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label><label>Employment type<select value={jobForm.employment_type} onChange={event => setJobForm(current => ({ ...current, employment_type: event.target.value as JobForm["employment_type"] }))}><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option><option value="internship">Internship</option></select></label></div>
          <div className="form-grid"><label>Experience level<select value={jobForm.experience_level} onChange={event => setJobForm(current => ({ ...current, experience_level: event.target.value as JobForm["experience_level"] }))}><option value="entry">Entry / junior</option><option value="mid">Mid-level</option><option value="senior">Senior</option><option value="lead">Lead / staff</option></select></label><label>Currency<input value={jobForm.currency} onChange={event => setJobForm(current => ({ ...current, currency: event.target.value.toUpperCase().slice(0, 3) }))} maxLength={3} placeholder="USD"/></label></div>
          <div className="form-grid"><label>Salary minimum<input type="number" min="0" value={jobForm.salary_min} onChange={event => setJobForm(current => ({ ...current, salary_min: event.target.value }))} placeholder="Optional"/></label><label>Salary maximum<input type="number" min="0" value={jobForm.salary_max} onChange={event => setJobForm(current => ({ ...current, salary_max: event.target.value }))} placeholder="Optional"/></label></div>
          <label>Job description<textarea required rows={7} value={jobForm.description} onChange={event => setJobForm(current => ({ ...current, description: event.target.value }))} placeholder="Explain the problem, responsibilities, team, and what success looks like. Minimum 40 characters." maxLength={20000}/></label>
          <label>Requirements and interview process<textarea rows={5} value={jobForm.requirements} onChange={event => setJobForm(current => ({ ...current, requirements: event.target.value }))} placeholder="Skills, experience, work authorization, interview steps, and helpful context." maxLength={12000}/></label>
          <button className="button" disabled={creatingJob}>{creatingJob ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>} {creatingJob ? "Saving…" : "Save job draft"}</button>
        </form>}
      </section>
    </section>

    <section className="career-card employer-list-card"><div className="card-heading"><div><span className="eyebrow">YOUR JOBS</span><h2>Roles you have posted</h2></div><span className="employer-count"><BriefcaseBusiness size={14}/>{jobs.length}</span></div>{jobs.length ? <div className="employer-job-list">{jobs.map(job => <article className="employer-job-row" key={job.id}><div className="employer-job-copy"><div className="employer-job-title"><strong>{job.title}</strong><span className={`job-status ${job.status}`}>{job.status}</span></div><div className="employer-job-meta"><span><MapPin size={13}/>{job.location}</span><span>{job.workplace_type}</span><span>{salaryLabel(job)}</span><span><Users size={13}/>{job.applicant_count ?? 0} applicants</span></div><small>{job.status === "published" ? `Published ${dateLabel(job.published_at)}` : "Not public yet"}</small></div><div className="employer-job-actions">{job.status === "draft" && <button className="button button-small" disabled={pendingId === job.id} onClick={() => void jobAction(job.id, "publish")}>{pendingId === job.id ? <LoaderCircle className="spin" size={14}/> : <ExternalLink size={14}/>}Publish</button>}{job.status === "published" && <button className="button button-outline button-small" disabled={pendingId === job.id} onClick={() => void jobAction(job.id, "close")}>{pendingId === job.id ? <LoaderCircle className="spin" size={14}/> : <XCircle size={14}/>}Close</button>}{job.status === "closed" && <button className="button button-small" disabled={pendingId === job.id} onClick={() => void jobAction(job.id, "reopen")}>{pendingId === job.id ? <LoaderCircle className="spin" size={14}/> : <RefreshCw size={14}/>}Reopen</button>}</div></article>)}</div> : <div className="employer-empty"><BriefcaseBusiness size={25}/><p>Your verified job posts will appear here.</p></div>}</section>

    <section className="career-card employer-applications-card"><div className="card-heading"><div><span className="eyebrow">CANDIDATE INBOX</span><h2>Applications from ReachFlow</h2></div><span className="employer-count"><Users size={14}/>{groupedApplications.length}</span></div>{groupedApplications.length ? <div className="employer-application-list">{groupedApplications.map(application => <article className="employer-application-row" key={application.id}><div className="employer-application-heading"><div><strong>{application.candidate_name}</strong><a href={`mailto:${application.candidate_email}`}>{application.candidate_email}</a><small>{application.job?.title ?? "Job role"} · Applied {dateLabel(application.created_at)}</small></div><select value={application.status} disabled={pendingId === application.id} onChange={event => void updateApplication(application.id, event.target.value)}>{applicationStatuses.map(status => <option key={status} value={status}>{status}</option>)}</select></div><div className="employer-application-body"><details><summary><FileText size={14}/>View resume</summary><pre>{application.resume_text}</pre></details>{application.cover_note && <p><strong>Candidate note:</strong> {application.cover_note}</p>}</div></article>)}</div> : <div className="employer-empty"><Users size={25}/><p>When a candidate applies, their profile snapshot and resume will appear here.</p></div>}</section>

    <div className="employer-safety"><ShieldCheck size={18}/><p><strong>Trust by design.</strong> Only verified companies can publish. Candidates apply with a ReachFlow profile and resume, and you can review or update every application status from this portal.</p><Link href="/jobs" className="text-button">Browse the public job board <ArrowRight size={14}/></Link></div>
  </div>;
}
