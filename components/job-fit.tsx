import { Check, CircleAlert, X } from "lucide-react";

export type FitData = {
  score?: number;
  verdict?: "strong-match" | "possible-match" | "weak-match" | "blocked";
  explanation?: {
    matchedSkills?: string[];
    missingSkills?: string[];
    components?: { skills?: number; title?: number; location?: number };
    hardGates?: { location?: string; workAuthorization?: string; employmentType?: string };
    evidence?: string[];
    blockers?: string[];
  };
  strengths?: string[];
  gaps?: string[];
};

const gateLabel = (value?: string) => value === "pass" ? "Pass" : value === "fail" ? "Blocked" : "Review";

export default function JobFit({ fit }: { fit?: FitData }) {
  const score = typeof fit?.score === "number" ? Math.max(0, Math.min(100, fit.score)) : null;
  const explanation = fit?.explanation;
  const blockers = explanation?.blockers ?? [];
  const matched = explanation?.matchedSkills ?? fit?.strengths ?? [];
  const missing = explanation?.missingSkills ?? fit?.gaps ?? [];
  return <section className="fit-card career-card"><div className="fit-score">{score === null ? <span className="fit-unknown">—</span> : <><strong>{score}</strong><span>/100</span></>}<small>{fit?.verdict ? fit.verdict.replace("-", " ") : "profile fit"}</small></div><div className="fit-copy"><span className="eyebrow">EVIDENCE-BASED COMPARISON</span><h2>How this role lines up</h2><p className="muted">This is a deterministic comparison of your saved evidence and the supplied posting. It is not a hiring prediction.</p>{blockers.length > 0 && <div className="fit-blockers"><CircleAlert size={16}/><div><strong>Review before applying</strong><ul>{blockers.map(item => <li key={item}>{item}</li>)}</ul></div></div>}<div className="fit-gates"><span>Location: {gateLabel(explanation?.hardGates?.location)}</span><span>Work authorization: {gateLabel(explanation?.hardGates?.workAuthorization)}</span><span>Employment type: {gateLabel(explanation?.hardGates?.employmentType)}</span></div><div className="fit-columns"><div><h3><Check size={15}/> Evidence found</h3>{matched.length ? <ul>{matched.map(item => <li key={item}>{item}</li>)}</ul> : <p className="muted small">No direct evidence found yet.</p>}</div><div><h3><X size={15}/> Gaps to consider</h3>{missing.length ? <ul>{missing.map(item => <li key={item}>{item}</li>)}</ul> : <p className="muted small">No tracked skill gaps detected.</p>}</div></div>{explanation?.evidence?.length ? <details className="fit-details"><summary>Why this score?</summary>{explanation.evidence.map(item => <p key={item}>{item}</p>)}</details> : null}</div></section>;
}
