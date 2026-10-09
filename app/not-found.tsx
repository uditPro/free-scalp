import Link from "next/link";
import { Header, Footer } from "@/components/brand";
export default function NotFound() { return <><Header/><main id="main" className="container page-intro not-found"><span className="eyebrow">A SMALL DETOUR · 404</span><h1>Not every path<br/>leads <em>somewhere.</em></h1><p>This page isn’t here. There’s still plenty to discover.</p><Link className="button" href="/">Back to ReachFlow</Link></main><Footer/></>; }
