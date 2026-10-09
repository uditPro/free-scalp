import { ImageResponse } from "next/og";

export const alt = "ReachFlow — Find your next opening";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 82px", background: "#faf9f6", color: "#253b35", fontFamily: "Arial" }}><div style={{ display: "flex", alignItems: "center", fontSize: 32, fontWeight: 700, letterSpacing: -1 }}>reachflow<span style={{ color: "#89a387" }}>.</span></div><div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", color: "#65786b", fontSize: 18, letterSpacing: 4, marginBottom: 22 }}>A BIGGER WORLD OF OPPORTUNITY</div><div style={{ display: "flex", fontSize: 82, lineHeight: 1.05, fontWeight: 600, letterSpacing: -4 }}>Less searching.</div><div style={{ display: "flex", fontSize: 82, lineHeight: 1.05, fontWeight: 600, letterSpacing: -4 }}>More possibility.</div></div><div style={{ display: "flex", fontSize: 21, color: "#7d877a" }}>Jobs · potential clients · research · source-linked discoveries</div></div>, size);
}
