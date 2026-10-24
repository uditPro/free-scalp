"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Check, Circle, Compass, FileText, LoaderCircle, MapPin, Rocket, Search, Send, Target, Users } from "lucide-react";
import { api } from "@/components/api-client";

type Plan = { targetRole: string; experienceLevel: "entry" | "mid" | "senior" | "lead"; locations: string; remote: boolean; startDate: string; targetApplications: number; targetOutreach: number; completedDays: number[] };
type Application = { id: string; status?: string; title?: string; company?: string; job?: { title?: string; company?: string } };
type ProfileResponse = { profile?: { fullName?: string; headline?: string; skills?: string[]; resume?: { text?: string } }; completion?: { score?: number; missing?: string[] } };

const today = () => new Date().toISOString().slice(0, 10);
const defaultPlan = (): Plan => ({ targetRole: "Software Engineer", experienceLevel: "mid", locations: "Remote / United States", remote: true, startDate: today(), targetApplications: 8, targetOutreach: 3, completedDays: [] });
const dayPlan = [
  { day: 1, title: "Position your story", description: "Complete your profile, paste your resume text, and define the roles you can defend in an interview.", action: "Open profile", icon: FileText, href: "/profile" },
  { day: 2, title: "Discover focused roles", description: "Run a targeted public-source search instead of spraying applications across every job board.", action: "Search roles", icon: Search, href: "search" },
  { day: 3, title: "Verify the opportunity", description: "Open the original listing, confirm the company and eligibility, then save only roles worth your time.", action: "Review applications", icon: Compass, href: "/applications" },
  { day: 4, title: "Prepare three strong applications", description: "Generate editable drafts, compare your evidence to the requirements, and remove anything you cannot substantiate.", action: "Open application workspaces", icon: Target, href: "/applications" },
  { day: 5, title: "Apply with intention", description: "Submit through the official company channel yourself and record the outcome in your private pipeline.", action: "Update application status", icon: Send, href: "/applications" },
  { day: 6, title: "Make human connections", description: "Use public, authorized contact details only. Personalize a short note; never send an unreviewed bulk message.", action: "Find more roles", icon: Users, href: "search" },
  { day: 7, title: "Follow up and learn", description: "Follow up once where appropriate, prepare for interviews, and improve the next search from what you learned.", action: "Review the pipeline", icon: Rocket, href: "/applications" },
];

export default function JobHuntSprint() {
  const [plan, setPlan] = useState<Plan>(defaultPlan);
  const [applications, setApplications] = useState<Application[]>([]);
  const [profile, setProfile] = useState<ProfileResponse>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    Promise.allSettled([api<{ plan: Plan }>("/api/job-hunt"), api<ProfileResponse>("/api/profile"), api<{ applications: Application[] }>("/api/applications")]).then(([planResult, profileResult, applicationsResult]) => {
      if (!active) return;
      if (planResult.status === "fulfilled") setPlan({ ...defaultPlan(), ...planResult.value.plan });
      else setError(planResult.reason instanceof Error ? planResult.reason.message : "Your sprint could not be loaded.");
      if (profileResult.status === "fulfilled") setProfile(profileResult.value);
      if (applicationsResult.status === "fulfilled") setApplications(applicationsResult.value.applications ?? []);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const completed = plan.completedDays.length;
  const activeDay = Math.min(7, completed + 1);
  const query = useMemo(() => `${plan.targetRole} ${plan.experienceLevel} ${plan.locations}${plan.remote ? " remote" : ""}`.trim(), [plan]);
  const activeApplications = applications.filter(item => !["withdrawn", "rejected"].includes(item.status ?? ""));
  const applied = applications.filter(item => ["submitted", "interviewing", "offer"].includes(item.status ?? "")).length;
  const progress = Math.round(completed / dayPlan.length * 100);

  async function persist(next: Plan, successMessage = "Sprint saved.") {
    setSaving(true); setError(""); setMessage("");
    try { const result = await api<{ plan: Plan }>("/api/job-hunt", next, { method: "PUT" }); setPlan(result.plan); setMessage(successMessage); }
    catch (err) { setError(err instanceof Error ? err.message : "Your sprint could not be saved."); }
    finally { setSaving(false); }
  }

  function updatePlan(key: keyof Plan, value: string | number | boolean) { setPlan(current => ({ ...current, [key]: value } as Plan)); }
  function actionHref(item: typeof dayPlan[number]) { return item.href === "search" ? `/dashboard?kind=jobs&query=${encodeURIComponent(query)}` : item.href; }
  async function toggleDay(day: number) { const completedDays = plan.completedDays.includes(day) ? plan.completedDays.filter(value => value !== day) : [...plan.completedDays, day].sort((a, b) => a - b); await persist({ ...plan, completedDays }, completedDays.includes(day) ? `Day ${day} marked complete.` : `Day ${day} reopened.`); }

  if (loading) return <div className="career-loading" role="status"><LoaderCircle className="spin"/>Building your seven-day sprint…</div>;

  return <div className="sprint-layout">
    <section className="sprint-hero"><div><span className="eyebrow">THE REACHFLOW JOB SPRINT</span><h1>Seven focused days toward your next <em>engineering role.</em></h1><p>Use this as an execution plan, not a promise of an offer. ReachFlow helps you find public sources, prepare editable drafts, and keep your decisions in one place. You remain in control of every message and application.</p><div className="sprint-actions"><Link className="button" href={`/dashboard?kind=jobs&query=${encodeURIComponent(query)}`}><Search size={16}/>Search for {plan.targetRole}</Link><Link className="button button-outline" href="/profile"><FileText size={16}/>Strengthen your profile</Link></div></div><div className="sprint-progress-card"><div className="sprint-progress-top"><span>Day {activeDay} of 7</span><strong>{progress}% complete</strong></div><div className="sprint-progress"><span style={{ width: `${progress}%` }}/></div><div className="sprint-progress-note"><CalendarDays size={14}/>Started {plan.startDate || today()}</div><div className="sprint-metrics"><div><strong>{activeApplications.length}</strong><span>active roles</span></div><div><strong>{applied}</strong><span>applied / active</span></div><div><strong>{plan.targetApplications}</strong><span>target applications</span></div></div></div></section>

    {error && <div className="notice notice-error" role="alert">{error}{error.includes("sign in") && <> <Link href="/login">Sign in</Link> to use the sprint.</>}</div>}
    {message && <div className="notice notice-success" role="status"><Check size={16}/>{message}</div>}

    <section className="sprint-grid">
      <div className="sprint-main"><div className="sprint-section-heading"><div><span className="eyebrow">YOUR EXECUTION LOOP</span><h2>One clear next step each day.</h2></div><span className="sprint-day-pill"><Circle size={11}/> Day {activeDay}</span></div><div className="sprint-days">{dayPlan.map(item => { const done = plan.completedDays.includes(item.day); const Icon = item.icon; return <article className={`sprint-day ${done ? "done" : item.day === activeDay ? "current" : ""}`} key={item.day}><button className="sprint-check" aria-label={`${done ? "Reopen" : "Complete"} day ${item.day}`} onClick={() => void toggleDay(item.day)} disabled={saving}>{done ? <Check size={16}/> : item.day}</button><div className="sprint-day-copy"><div className="sprint-day-top"><span className="eyebrow">DAY {item.day}</span><Icon size={18}/></div><h3>{item.title}</h3><p>{item.description}</p><Link href={actionHref(item)} className="text-button">{item.action}<ArrowRight size={14}/></Link></div></article>; })}</div></div>
      <aside className="sprint-side"><section className="career-card sprint-settings"><div className="card-heading"><div><span className="eyebrow">MAKE IT SPECIFIC</span><h2>Your target</h2></div><Target size={20}/></div><label>Target role<input value={plan.targetRole} onChange={event => updatePlan("targetRole", event.target.value)} maxLength={160}/></label><label>Experience level<select value={plan.experienceLevel} onChange={event => updatePlan("experienceLevel", event.target.value)}><option value="entry">Entry / junior</option><option value="mid">Mid-level</option><option value="senior">Senior</option><option value="lead">Lead / staff</option></select></label><label>Location or eligibility<input value={plan.locations} onChange={event => updatePlan("locations", event.target.value)} maxLength={240}/></label><label className="sprint-checkbox"><input type="checkbox" checked={plan.remote} onChange={event => updatePlan("remote", event.target.checked)}/><span><strong>Include remote roles</strong><small>Still verify the employer's actual eligibility.</small></span></label><div className="sprint-two-fields"><label>Start date<input type="date" value={plan.startDate} onChange={event => updatePlan("startDate", event.target.value)}/></label><label>Application target<input type="number" min={1} max={50} value={plan.targetApplications} onChange={event => updatePlan("targetApplications", Number(event.target.value))}/></label></div><label>Human outreach target<input type="number" min={0} max={30} value={plan.targetOutreach} onChange={event => updatePlan("targetOutreach", Number(event.target.value))}/><small className="field-help">A planning target only. No automatic messages are sent.</small></label><button className="button full-width" disabled={saving} onClick={() => void persist(plan)}>{saving ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>}Save sprint</button></section>
        <section className="career-card sprint-profile-card"><span className="eyebrow">PROFILE READINESS</span><h2>{profile.completion?.score ?? 0}% ready</h2><p>{profile.completion?.missing?.length ? `Still missing: ${profile.completion.missing.slice(0, 3).join(", ")}.` : "Your profile has the core evidence needed for a tailored draft."}</p><Link href="/profile" className="text-button">Improve profile <ArrowRight size={14}/></Link></section>
        <section className="sprint-safety"><MapPin size={16}/><div><strong>Human approval stays in the loop.</strong><p>Verify the official listing, edit every draft, and submit only through the employer's authorized channel. Never share passwords, cookies, or private contact data with ReachFlow.</p></div></section>
      </aside>
    </section>
  </div>;
}
