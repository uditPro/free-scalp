"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, LoaderCircle } from "lucide-react";
import { api, safeExternalUrl } from "./api-client";

export default function Pricing() {
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  async function checkout(plan: "starter" | "pro") {
    setPending(plan); setError("");
    try {
      const response = await api<{ url: string }>("/api/billing/checkout", { plan });
      const url = safeExternalUrl(response.url);
      if (!url) throw new Error("Checkout could not be opened. Please try again.");
      window.location.assign(url);
    } catch (err) { const message = err instanceof Error ? err.message : "Unable to open checkout."; if (/sign in|session/i.test(message)) { window.location.assign(`/login?next=${encodeURIComponent("/pricing")}`); return; } setError(message); setPending(""); }
  }
  return <>
    <div className="pricing-grid">
      <article className="plan-card">
        <span className="eyebrow">FIRST STEPS</span><h2>Free</h2><p>Make a little space for possibility.</p>
        <div className="plan-price">10 searches / month</div><span className="plan-caption">A free account. A fresh perspective.</span>
        <Link className="button button-outline full-width" href="/signup">Create an account <ArrowUpRight size={17}/></Link>
        <ul>{["Jobs, clients, and research", "Source-linked discoveries", "Personal search history", "CSV export of your results"].map(item => <li key={item}><Check size={16}/>{item}</li>)}</ul>
      </article>
      {(["starter", "pro"] as const).map(plan => <article className={`plan-card ${plan === "starter" ? "featured-plan" : ""}`} key={plan}>
        {plan === "starter" && <span className="plan-badge">A GOOD PLACE TO GROW</span>}
        <span className="eyebrow">{plan === "starter" ? "BUILD MOMENTUM" : "GO A LITTLE FURTHER"}</span>
        <h2>{plan === "starter" ? "Starter" : "Pro"}</h2><p>{plan === "starter" ? "For a more intentional search habit." : "For your ongoing discovery workflow."}</p>
        <div className="plan-price">{plan === "starter" ? "100" : "500"} searches / month</div><span className="plan-caption">Current price and terms shown at checkout.</span>
        <button className={`button ${plan === "pro" ? "button-outline" : ""} full-width`} onClick={() => checkout(plan)} disabled={!!pending}>
          {pending === plan ? <LoaderCircle className="spin" size={17}/> : <>Choose {plan === "starter" ? "Starter" : "Pro"}<ArrowUpRight size={17}/></>}
        </button>
        <ul>{["Everything in your free workspace", "More monthly search capacity", "Secure checkout with Stripe", "Self-service subscription management"].map(item => <li key={item}><Check size={16}/>{item}</li>)}</ul>
      </article>)}
    </div>
    {error && <div className="notice notice-error pricing-error" role="alert">{error} <Link href="/login?next=%2Fpricing">Sign in</Link> if you haven’t already.</div>}
    <p className="pricing-fine-print">Sign in before choosing a paid plan. Prices, billing period, and payment terms are confirmed in checkout.<br/>Search allowances reset monthly and are enforced by the server. Failed provider attempts also count toward your allowance.</p>
  </>;
}
