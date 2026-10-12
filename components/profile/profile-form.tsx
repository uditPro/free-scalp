"use client";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Check, LoaderCircle, Plus, X } from "lucide-react";
import { api } from "@/components/api-client";

export type CareerProfile = { name: string; headline: string; summary: string; skills: string[]; experience: string; targets: string };
const blank: CareerProfile = { name: "", headline: "", summary: "", skills: [], experience: "", targets: "" };

export default function ProfileForm() {
  const [profile, setProfile] = useState<CareerProfile>(blank);
  const [skill, setSkill] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  useEffect(() => { api<Partial<CareerProfile>>("/api/profile").then(data => setProfile({ ...blank, ...data, skills: Array.isArray(data.skills) ? data.skills : [] })).catch(err => setError(err instanceof Error ? err.message : "Profile could not be loaded.")).finally(() => setLoading(false)); }, []);
  function update(key: keyof CareerProfile, value: string) { setProfile(current => ({ ...current, [key]: value })); }
  function addSkill(event?: FormEvent) { event?.preventDefault(); const value = skill.trim(); if (value && !profile.skills.includes(value)) setProfile(current => ({ ...current, skills: [...current.skills, value] })); setSkill(""); }
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); setError(""); setMessage(""); try { await api("/api/profile", profile); setMessage("Profile saved. Your next application will use this version."); } catch (err) { setError(err instanceof Error ? err.message : "Profile could not be saved."); } finally { setSaving(false); } }
  if (loading) return <div className="career-loading" role="status"><LoaderCircle className="spin"/>Loading your profile…</div>;
  return <form className="profile-form" onSubmit={save}>
    {error && <div className="notice notice-error" role="alert">{error}</div>}{message && <div className="notice notice-success" role="status"><Check size={16}/>{message}</div>}
    <section className="career-card"><div className="card-heading"><div><span className="eyebrow">THE THROUGH-LINE</span><h2>Your professional story</h2></div><span className="required-note">Required fields marked *</span></div>
      <div className="form-grid"><label>Full name *<input required value={profile.name} onChange={e => update("name", e.target.value)} placeholder="Alex Morgan" /></label><label>Headline *<input required value={profile.headline} onChange={e => update("headline", e.target.value)} placeholder="Product designer building thoughtful tools" /></label></div>
      <label>Short summary<textarea required rows={5} value={profile.summary} onChange={e => update("summary", e.target.value)} placeholder="A concise introduction to your experience, strengths, and the work you want to do." /></label>
      <label>Skills<div className="skill-editor"><input value={skill} onChange={e => setSkill(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addSkill(e); }} placeholder="Add a skill"/><button type="button" className="button button-outline button-small" onClick={() => addSkill()}><Plus size={15}/>Add</button></div><div className="skill-list">{profile.skills.map(item => <span key={item}>{item}<button type="button" aria-label={`Remove ${item}`} onClick={() => setProfile(current => ({ ...current, skills: current.skills.filter(value => value !== item) }))}><X size={12}/></button></span>)}</div></label>
    </section>
    <section className="career-card"><div className="card-heading"><div><span className="eyebrow">CONTEXT</span><h2>Give applications something real to work with</h2></div></div><label>Experience<textarea rows={6} value={profile.experience} onChange={e => update("experience", e.target.value)} placeholder="Roles, projects, outcomes, and the details you want to remember." /></label><label>Target roles and preferences<textarea rows={4} value={profile.targets} onChange={e => update("targets", e.target.value)} placeholder="Role types, industries, locations, work style, or compensation context." /></label></section>
    <div className="form-actions"><span className="muted small">Drafts are deterministic and based only on this profile and the job details.</span><button className="button" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={16}/>Saving…</> : <>Save profile <ArrowRight size={16}/></>}</button></div>
  </form>;
}
