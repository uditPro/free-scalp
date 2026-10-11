import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { blogBySlug } from "@/lib/blog";

export const alt = "ReachFlow field guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = blogBySlug.get(slug);
  if (!article) notFound();

  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "52px 64px", background: "#faf9f6", color: "#253b35", fontFamily: "sans-serif", borderTop: "14px solid #245d47" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 12, background: "#245d47", color: "#ffffff", fontSize: 30, fontWeight: 700 }}>R</div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>ReachFlow</div>
        </div>
        <div style={{ fontSize: 20, letterSpacing: 3, color: "#245d47" }}>FIELD GUIDE</div>
      </div>
      <div style={{ display: "flex", marginTop: 44 }}>
        <div style={{ padding: "10px 18px", borderRadius: 8, background: "#e7eee4", color: "#245d47", fontSize: 22, fontWeight: 700 }}>{article.category}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", flexGrow: 1, padding: "20px 0", fontSize: article.title.length > 80 ? 50 : article.title.length > 60 ? 56 : 64, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2 }}>{article.title}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "2px solid #e4e6df", paddingTop: 22, fontSize: 21, color: "#245d47" }}>
        <div>Find the signal. Make your move.</div>
        <div>ReachFlow / Blog</div>
      </div>
    </div>,
    size,
  );
}
