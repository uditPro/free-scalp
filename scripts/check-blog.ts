import assert from 'node:assert/strict';
import { blogArticles } from '../lib/blog';

const origin = process.argv[2] || 'http://localhost:3011';
async function main() {
  const index = await fetch(`${origin}/blog`);
  assert.equal(index.status, 200, 'Blog index');
  const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
  for (const article of blogArticles) {
    const path = `/blog/${article.slug}`;
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.ok(html.includes(article.title), `${path}: title`);
    assert.ok(html.includes('rel="canonical"'), `${path}: canonical`);
    assert.ok(html.includes('"@type":"Article"'), `${path}: schema`);
    assert.ok(html.includes(article.hero.src), `${path}: correct image`);
    assert.ok(sitemap.includes(path), `${path}: sitemap`);
    const image = await fetch(`${origin}${article.hero.src}`);
    assert.equal(image.status, 200, article.hero.src);
    assert.match(image.headers.get('content-type') || '', /image\/svg\+xml/);
    const preview = await fetch(`${origin}${path}/opengraph-image`);
    assert.equal(preview.status, 200, `${path}: social preview`);
    assert.match(preview.headers.get('content-type') || '', /image\/png/);
    assert.ok((await preview.arrayBuffer()).byteLength > 1000);
    console.log(`PASS ${path}: page, metadata, sitemap, image`);
  }
  assert.equal((await fetch(`${origin}/blog/not-a-real-article`)).status, 404);
  console.log('All ten articles and images passed HTTP checks; unknown article returns 404.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
