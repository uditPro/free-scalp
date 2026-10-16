"use client";
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function AffiliateCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); }
  }
  return <button className="button button-small" type="button" onClick={copy}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Copied' : 'Copy'}</button>;
}
