"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/components/api-client";

const visitorKey = "reachflow:visitor-id";

function getVisitorId() {
  const existing = window.localStorage.getItem(visitorKey);
  if (existing) return existing;
  const created = typeof window.crypto?.randomUUID === "function" ? window.crypto.randomUUID() : `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(visitorKey, created);
  return created;
}

export default function SitePresence() {
  const pathname = usePathname();
  useEffect(() => {
    let active = true;
    const record = async () => {
      if (!active) return;
      try { await api("/api/analytics", { visitorId: getVisitorId(), path: pathname || "/" }, { method: "POST" }); } catch { /* Analytics must never block page use. */ }
    };
    void record();
    const timer = window.setInterval(() => { void record(); }, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [pathname]);
  return null;
}
