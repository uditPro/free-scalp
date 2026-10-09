"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, LoaderCircle } from "lucide-react";
import { Brand } from "./brand";
import { api } from "./api-client";

type AuthResult = { ok: boolean; authenticated?: boolean; message?: string };
export default function AuthForm({ mode }: { mode: "login" | "signup" | "reset" }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [resendPending, setResendPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "confirmation") setError("That confirmation link could not be verified. It may have expired, or opened in a different browser. Enter your email below to request a fresh confirmation email.");
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  async function resend() {
    if (!email.trim()) { setError("Enter your email address above first."); return; }
    setResendPending(true); setError(""); setMessage("");
    try { const result = await api<AuthResult>("/api/auth", { action: "resend", email }); setMessage(result.message ?? "If confirmation is needed, a new email will be sent."); setCooldown(60); }
    catch (err) { setError(err instanceof Error ? err.message : "The confirmation email could not be sent."); }
    finally { setResendPending(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await api<AuthResult>("/api/auth", { action: mode, email, ...(mode !== "reset" ? { password: data.get("password") } : {}) });
      if (result.authenticated) { const next = new URLSearchParams(window.location.search).get("next"); window.location.assign(next?.startsWith("/") ? next : "/dashboard"); return; }
      setMessage(result.message ?? (mode === "signup" ? "Check your inbox for a verification link. Open it in this browser to finish creating your account." : "If an account exists, you’ll receive an email with instructions."));
      if (mode === "signup") setCooldown(60);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong. Please try again."); }
    finally { setPending(false); }
  }
  const busy = pending || resendPending;
  return <main id="main" className="auth-layout">
    <aside className="auth-story">
      <Brand/>
      <div><span className="eyebrow">MAKE ROOM FOR WHAT’S NEXT</span><h1>A little curiosity.<br/><em>A whole new<br/>direction.</em></h1><p>The right opportunity can change everything.<br/>Let’s start with a search.</p><span className="auth-asterisk" aria-hidden="true">✳</span></div>
      <span className="auth-bottom">YOUR NEXT CHAPTER STARTS HERE.</span>
    </aside>
    <section className="auth-form-area">
      <Link className="back-link" href="/"><ArrowLeft size={16}/> Back to ReachFlow</Link>
      <div className="auth-form-card">
        <span className="eyebrow">{mode === "signup" ? "A FRESH START" : mode === "reset" ? "LET’S GET YOU BACK IN" : "GOOD TO SEE YOU AGAIN"}</span>
        <h2>{mode === "signup" ? "Find your next." : mode === "reset" ? "Forgot your password?" : "Welcome back."}</h2>
        <p className="muted">{mode === "signup" ? "Create your account and open up the possibilities." : mode === "reset" ? "Enter your email and we’ll send you a reset link." : "Sign in to pick up where your curiosity left off."}</p>
        <form onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} placeholder="you@example.com" autoComplete="email" required disabled={busy}/>
          {mode !== "reset" && <>
            <div className="password-label"><label htmlFor="password">Password</label>{mode === "login" && <Link href="/reset-password">Forgot password?</Link>}</div>
            <input id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} maxLength={128} placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} required disabled={busy}/>
          </>}
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          {message && <div className="notice notice-success" role="status">{message}{mode === "signup" && <p>Check your spam folder too. Open the email link in this browser.</p>}</div>}
          <button className="button full-width" disabled={busy}>{pending ? <LoaderCircle size={18} className="spin"/> : <>{mode === "signup" ? "Create your account" : mode === "reset" ? "Send reset link" : "Sign in"}<ArrowUpRight size={18}/></>}</button>
        </form>
        {mode !== "reset" && <button className="text-button auth-resend" type="button" onClick={resend} disabled={busy || cooldown > 0}>{resendPending ? "Sending…" : cooldown ? `Resend available in ${cooldown}s` : "Resend confirmation email"}</button>}
        <p className="auth-switch">{mode === "signup" ? <>Already have an account? <Link href="/login">Sign in</Link></> : mode === "reset" ? <Link href="/login">Back to sign in</Link> : <>New around here? <Link href="/signup">Create an account</Link></>}</p>
      </div>
      <p className="auth-bottom-note">Thoughtful searches. Real sources. Your next possibility.</p>
    </section>
  </main>;
}
