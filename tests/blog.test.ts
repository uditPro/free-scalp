import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { blogArticles } from "../lib/blog";

test("blog registry contains exactly ten source-backed articles", () => {
  assert.equal(blogArticles.length, 10);
  assert.equal(new Set(blogArticles.map(article => article.slug)).size, 10);
  for (const article of blogArticles) {
    assert.equal(article.publishedAt, "2026-10-11");
    assert.equal(article.updatedAt, "2026-10-11");
    assert.match(article.hero.src, /^\/blog\/.*\.svg$/);
    assert.ok(article.sources.length >= 1);
    assert.ok(article.faq.length >= 3);
    assert.ok(article.related.length >= 1);
    assert.ok(article.sections.length >= 3);
  }
});

function visibleWords(article: typeof blogArticles[number]) {
  const content = [article.directAnswer, ...article.sections.flatMap(section => [section.heading, ...section.paragraphs]), ...article.faq.flatMap(item => [item.question, item.answer])].join(" ");
  return content.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g)?.length ?? 0;
}

test("every article has a substantial visible answer", (context) => {
  for (const article of blogArticles) {
    const words = visibleWords(article);
    context.diagnostic(`${article.slug}: ${words} words (direct answer, section headings and prose, FAQ)`);
    assert.ok(words >= 1000 && words <= 1200, `${article.slug} has ${words} visible words`);
    assert.equal(article.readingTime, `${Math.ceil(words / 200)} min read`);
  }
});

test("article heroes have independent metadata and existing unique local assets", () => {
  assert.equal(new Set(blogArticles.map(article => article.hero)).size, 10);
  assert.equal(new Set(blogArticles.map(article => article.hero.src)).size, 10);
  assert.equal(new Set(blogArticles.map(article => article.hero.alt)).size, 10);
  for (const article of blogArticles) {
    assert.equal(article.hero.src, `/blog/${article.slug}.svg`);
    assert.ok(article.hero.alt.length > 30);
    assert.ok(existsSync(new URL(`../public${article.hero.src}`, import.meta.url)), article.hero.src);
  }
});
