"use client";
import { CSSProperties, FormEvent, useEffect, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, Check, FlaskConical, Search, SlidersHorizontal, Users, Globe2, Sparkles } from "lucide-react";
import HeroOrbit from "./hero-orbit";

const examples = {
  jobs: { query: "Remote design roles at climate-focused companies", label: "Job opportunities", cards: [{ tag: "CAREERS", title: "Design a more sustainable future", description: "An example of a product design opportunity at a climate technology company.", meta: "Product design · Remote", color: "mint" }, { tag: "COMMUNITY", title: "Your next chapter starts here", description: "An example of a role shared in a design-focused community.", meta: "Design systems · Full-time", color: "peach" }] },
  clients: { query: "Early-stage founders looking for a brand designer", label: "Potential clients", cards: [{ tag: "FOUNDER COMMUNITY", title: "A new venture. A fresh identity.", description: "An example of a founder discussing a branding project for their startup.", meta: "Brand strategy · Early-stage", color: "peach" }, { tag: "PUBLIC DISCUSSION", title: "Good work starts with a conversation", description: "An example of a public request for independent creative support.", meta: "Creative services · Project", color: "mint" }] },
  research: { query: "What are people saying about local-first software?", label: "Research discoveries", cards: [{ tag: "TECH DISCUSSION", title: "Software that feels like yours", description: "An example of a discussion about ownership, offline access, and local data.", meta: "Local-first · Discussion", color: "mint" }, { tag: "COMMUNITY", title: "Ideas worth looking into", description: "An example of an independent perspective on collaborative software.", meta: "Collaboration · Perspective", color: "peach" }] },
};
type Kind = keyof typeof examples;

export default function SamplePreview() {
  const [kind, setKind] = useState<Kind>("jobs");
  const [query, setQuery] = useState(examples.jobs.query);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const example = examples[kind];
  useEffect(() => {
    setQuery(example.query);
    setSubmittedQuery("");
  }, [example.query]);

  const submitSearch = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const nextQuery = query.trim();
    if (nextQuery) setSubmittedQuery(nextQuery);
  };

  const isRevealed = submittedQuery.length > 0;
  return <div className={`preview-shell ${isRevealed ? "is-revealed" : ""}`}>
    <div className="preview-orbit"><HeroOrbit query={query} active={isRevealed} /></div>
    <div className="preview-toolbar"><div className="window-dots"><i/><i/><i/></div><span>YOUR NEXT POSSIBILITY</span><span className="sample-badge">Interactive sample</span></div>
    <div className="preview-body"><aside className="preview-sidebar"><div className="mini-brand"><Sparkles size={18}/> Workspace</div>{([ ["jobs", BriefcaseBusiness, "Find jobs"], ["clients", Users, "Find clients"], ["research", FlaskConical, "Explore ideas"] ] as const).map(([value, Icon, label]) => <button key={value} className={kind === value ? "preview-tab active" : "preview-tab"} onClick={() => setKind(value)} aria-pressed={kind === value}><Icon size={16}/>{label}</button>)}<div className="preview-sidebar-bottom"><span className="avatar">Y</span><span>Your workspace<small>Make room for what’s next</small></span></div></aside>
      <div className="preview-content"><div className="preview-heading"><div><span className="eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</span><h3>{example.label}</h3></div><SlidersHorizontal size={18}/></div>
        <form className={`sample-search ${query ? "has-query" : ""}`} onSubmit={submitSearch} role="search"><Search size={17}/><label className="sr-only" htmlFor="hero-search">Search the possibilities</label><input id="hero-search" value={query} onChange={event => { setQuery(event.target.value); setSubmittedQuery(""); }} placeholder="What possibility are you looking for?" autoComplete="off" /><button className="sample-search-arrow" type="submit" aria-label="Reveal sample discoveries"><ArrowUpRight size={17}/></button></form>
        <div className="sample-status" aria-live="polite"><span>{isRevealed ? <><Sparkles size={14}/> Revealed from your search</> : <><Check size={14}/> Type a direction to reveal possibilities</>}</span><span>{isRevealed ? `Inspired by “${submittedQuery}”` : "Sample data · not live results"}</span></div>
        <div className="sample-cards" aria-live="polite">{example.cards.map((card, index) => <article key={card.title} className={`sample-card ${isRevealed ? "card-revealed" : ""}`} style={{ "--card-delay": `${index * 90}ms` } as CSSProperties}><div className={`sample-card-icon ${card.color}`}><Globe2 size={20}/></div><span className="card-source">{card.tag}</span><h4>{isRevealed ? card.title : "A signal worth following"}</h4><p>{isRevealed ? card.description : "Search above to uncover an illustrative source and see where it leads."}</p><div className="sample-card-bottom"><span>{isRevealed ? card.meta : "Waiting for your signal"}</span><ArrowUpRight size={16}/></div></article>)}</div><div className="sample-disclaimer">This preview is illustrative. Create a workspace to search real, source-linked results.</div>
      </div></div></div>;
}
