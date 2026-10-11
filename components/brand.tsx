"use client";
import Link from "next/link";
import { ArrowUpRight, Command, LayoutDashboard, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "./api-client";

export function Brand() { return <Link className="brand" href="/" aria-label="ReachFlow home"><span className="brand-mark"><Command size={20}/></span>reachflow<span className="brand-period">.</span></Link>; }
type SessionResponse = { user: { email: string } | null };
export function Header() {
  const [session, setSession] = useState<"loading" | "signed-in" | "signed-out">("loading");
  useEffect(() => {
    let active = true;
    api<SessionResponse>("/api/session").then(result => { if (active) setSession(result.user ? "signed-in" : "signed-out"); }).catch(() => { if (active) setSession("signed-out"); });
    return () => { active = false; };
  }, []);
  async function logout() {
    try { await api("/api/auth", { action: "logout" }); } finally { window.location.assign("/"); }
  }
  return <header className="site-header site-header-floating"><div className="header-inner"><Brand/><nav aria-label="Main navigation"><Link href="/#possibilities">Use cases</Link><Link href="/#how-it-works">How it works</Link><Link href="/blog">Field guide</Link><Link href="/pricing">Pricing</Link></nav><div className="nav-actions">
    {session === "loading" ? <span className="nav-session-loading" aria-label="Checking sign-in status"/> : session === "signed-in" ? <><Link className="button button-small" href="/dashboard"><LayoutDashboard size={15}/> Dashboard</Link><button className="text-button nav-logout" type="button" onClick={logout}><LogOut size={15}/> Log out</button></> : <><Link className="login-link" href="/login">Log in</Link><Link className="button button-small" href="/signup">Get started <ArrowUpRight size={15}/></Link></>}
  </div></div></header>;
}
export function Footer() { return <footer className="site-footer"><div className="container footer-inner"><div><Brand/><p>A little less searching. A lot more possibility.</p></div><div className="footer-links"><Link href="/blog">Field guide</Link><Link href="/pricing">Pricing</Link><Link href="/dashboard">Workspace</Link><Link href="/#faq">Questions?</Link></div><span className="footer-note">Built for the curious. © {new Date().getFullYear()} ReachFlow</span></div></footer>; }
