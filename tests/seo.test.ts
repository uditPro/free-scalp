import assert from "node:assert/strict";
import test from "node:test";
import sitemap from "../app/sitemap";
import { seoOrigin } from "../lib/seo";

test("SEO URLs use the non-redirecting www production alias", () => {
  assert.equal(seoOrigin({ APP_URL: "https://reachflow.lol" }), "https://www.reachflow.lol");
  assert.equal(seoOrigin({ APP_URL: "https://www.reachflow.lol" }), "https://www.reachflow.lol");
});

test("SEO origin supports an explicit host override and safe local fallback", () => {
  assert.equal(seoOrigin({ APP_URL: "https://reachflow.lol", SEO_CANONICAL_ORIGIN: "https://www.example.com" }), "https://www.example.com");
  assert.equal(seoOrigin({}), "http://localhost:3000");
});

test("sitemap publishes only public canonical resources", () => {
  const urls = sitemap().map(entry => String(entry.url));
  assert.ok(urls.includes("http://localhost:3000/resources"));
  assert.ok(urls.includes("http://localhost:3000/editorial-policy"));
  assert.ok(urls.includes("http://localhost:3000/jobs"));
  assert.ok(urls.every(url => !/\/(dashboard|profile|applications|login|signup|reset-password)(\/|$)/.test(url)));
  const article = urls.find(url => url.includes("/blog/") && !url.endsWith("/blog/"));
  assert.ok(article);
  const entry = sitemap().find(item => item.url === article);
  assert.ok(entry && "images" in entry);
  assert.match(String(entry && "images" in entry ? entry.images?.[0] : ""), /opengraph-image$/);
});
