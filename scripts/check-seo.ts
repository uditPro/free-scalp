/*
 * Dependency-free HTTP smoke checks for the public ReachFlow surface.
 *
 * Run with Node 20+ through tsx:
 *   npx tsx scripts/check-seo.ts [request-origin] [canonical-origin]
 *
 * This intentionally reads no application configuration or filesystem data.
 * The public blog slugs are kept here so the check can run against any build,
 * including a local build whose generated canonical URLs point at production.
 */

const PRODUCTION_ORIGIN = "https://www.reachflow.lol";
const REQUEST_TIMEOUT_MS = 12_000;

const BLOG_SLUGS = [
  "find-fresh-job-opportunities-before-they-spread",
  "ai-job-search-without-trusting-every-result",
  "research-company-before-applying",
  "find-freelance-clients-with-public-buying-signals",
  "sam-gov-freelance-opportunities",
  "government-procurement-data-for-freelancers",
  "public-web-research-for-freelancers",
  "find-companies-that-need-freelancers",
  "verify-remote-job-location-and-eligibility",
  "responsible-ai-opportunity-research",
] as const;

const PUBLIC_PATHS = [
  "/",
  "/blog",
  "/pricing",
  "/resources",
  "/editorial-policy",
  ...BLOG_SLUGS.map(slug => `/blog/${slug}`),
] as const;

const AUTH_PATHS = ["/login", "/signup", "/reset-password"] as const;
const PRIVATE_PATHS = [
  "/dashboard",
  "/profile",
  "/applications",
  "/applications/seo-smoke-test-detail",
] as const;

type Failure = { scope: string; message: string };
type ElementRecord = { attrs: string; inner: string };
type PublicPage = {
  path: string;
  html: string;
  response: Response;
  h1: string;
  jsonLd: unknown[];
};
type SitemapEntry = {
  loc: string;
  lastmod?: string;
  images: string[];
};
type RobotsRule = { kind: "allow" | "disallow"; path: string };
type RobotsGroup = { agents: string[]; rules: RobotsRule[] };

const failures: Failure[] = [];
const checkedImages = new Set<string>();
const stats = {
  images: 0,
  jsonLdDocuments: 0,
  publicPages: 0,
};

let requestOrigin = PRODUCTION_ORIGIN;
let canonicalOrigin = PRODUCTION_ORIGIN;

function fail(scope: string, message: string): void {
  failures.push({ scope, message });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&(?:amp|#38);/gi, "&")
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:apos|#39|#x27);/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)));
}

function getAttribute(attrs: string, name: string): string | undefined {
  const pattern = new RegExp(
    `(?:^|\\s)${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`,
    "i",
  );
  const match = attrs.match(pattern);
  return match ? decodeHtml(match[1] ?? match[2] ?? match[3] ?? "") : undefined;
}

function extractElements(html: string, name: string): ElementRecord[] {
  const result: ElementRecord[] = [];
  const pattern = new RegExp(`<${escapeRegExp(name)}\\b([^>]*)>([\\s\\S]*?)<\\/${escapeRegExp(name)}\\s*>`, "gi");
  for (const match of html.matchAll(pattern)) {
    result.push({ attrs: match[1] ?? "", inner: match[2] ?? "" });
  }
  return result;
}

function extractStartTags(html: string, name: string): string[] {
  const result: string[] = [];
  const pattern = new RegExp(`<${escapeRegExp(name)}\\b[^>]*>`, "gi");
  for (const match of html.matchAll(pattern)) result.push(match[0]);
  return result;
}

function textContent(value: string): string {
  return decodeHtml(value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOrigin(raw: string, label: string): string | undefined {
  try {
    const value = new URL(raw);
    if (value.protocol !== "http:" && value.protocol !== "https:") throw new Error("must use http or https");
    if (value.username || value.password) throw new Error("must not contain credentials");
    if (value.pathname !== "/" || value.search || value.hash) throw new Error("must be an origin without a path, query, or hash");
    return value.origin;
  } catch (error) {
    console.error(`Invalid ${label} \"${raw}\": ${error instanceof Error ? error.message : String(error)}`);
    console.error("Usage: npx tsx scripts/check-seo.ts [request-origin] [canonical-origin]");
    return undefined;
  }
}

function isLocalOrigin(origin: string): boolean {
  const hostname = new URL(origin).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

function canonicalUrl(path: string): string {
  return new URL(path, `${canonicalOrigin}/`).href;
}

function requestUrl(path: string): string {
  return new URL(path, `${requestOrigin}/`).href;
}

function networkUrlForCanonical(raw: string): string {
  const value = new URL(raw);
  if (value.origin !== canonicalOrigin) return value.href;
  return new URL(`${value.pathname}${value.search}${value.hash}`, `${requestOrigin}/`).href;
}

function describeResponse(response: Response): string {
  const contentType = response.headers.get("content-type") || "missing content-type";
  return `status ${response.status}, content-type ${contentType}`;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "ReachFlow SEO smoke test" },
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? `timed out after ${REQUEST_TIMEOUT_MS}ms`
      : error instanceof Error ? error.message : String(error);
    throw new Error(message);
  } finally {
    clearTimeout(timer);
  }
}

function isRedirect(response: Response): boolean {
  return response.status >= 300 && response.status < 400;
}

function headerHasNoindex(response: Response): boolean {
  return /(?:noindex|none)\b/i.test(response.headers.get("x-robots-tag") || "");
}

function directivesFor(html: string, response: Response, names: string[]): string[] {
  const wanted = new Set(names.map(name => name.toLowerCase()));
  const values: string[] = [];
  for (const tag of extractStartTags(html, "meta")) {
    const name = (getAttribute(tag, "name") || "").toLowerCase();
    if (wanted.has(name)) values.push(getAttribute(tag, "content") || "");
  }
  const header = response.headers.get("x-robots-tag");
  if (header) values.push(header);
  return values;
}

function containsIndexDirective(value: string): boolean {
  return /(?:^|[,\s])index(?:$|[,\s])/i.test(value);
}

function containsNoindexDirective(value: string): boolean {
  return /(?:noindex|none)\b/i.test(value);
}

function checkPublicRobots(path: string, html: string, response: Response): void {
  const values = directivesFor(html, response, ["robots", "googlebot"]);
  if (values.some(containsNoindexDirective)) fail(path, "public page has a robots/googlebot/header noindex directive");
  if (headerHasNoindex(response)) fail(path, "public page has X-Robots-Tag noindex");
}

function checkNoindex(path: string, html: string, response: Response): void {
  const values = directivesFor(html, response, ["robots", "googlebot"]);
  if (!values.some(containsNoindexDirective)) fail(path, "expected noindex in robots, googlebot, or X-Robots-Tag directives");
  if (values.some(containsIndexDirective)) fail(path, "a robots/googlebot/header directive overrides noindex with index");
  const googlebotValues = directivesFor(html, response, ["googlebot"]);
  if (googlebotValues.length > 0 && !googlebotValues.some(containsNoindexDirective)) {
    fail(path, "googlebot directive does not contain noindex");
  }
}

function jsonLdScripts(html: string, scope: string): unknown[] {
  const documents: unknown[] = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(pattern)) {
    const attrs = match[1] || "";
    const type = (getAttribute(attrs, "type") || "").split(";", 1)[0].trim().toLowerCase();
    if (type !== "application/ld+json") continue;
    try {
      documents.push(JSON.parse(match[2] || ""));
      stats.jsonLdDocuments += 1;
    } catch (error) {
      fail(scope, `invalid JSON-LD: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (documents.length === 0) fail(scope, "no valid JSON-LD document found");
  return documents;
}

function typeIncludes(value: unknown, expected: string): boolean {
  return typeof value === "string"
    ? value.toLowerCase() === expected.toLowerCase()
    : Array.isArray(value) && value.some(item => typeIncludes(item, expected));
}

function jsonLdObjects(value: unknown): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = [];
  const visit = (item: unknown): void => {
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
    } else if (item && typeof item === "object") {
      const object = item as Record<string, unknown>;
      objects.push(object);
      for (const child of Object.values(object)) visit(child);
    }
  };
  visit(value);
  return objects;
}

function stringUrls(value: unknown): string[] {
  const result: string[] = [];
  const visit = (item: unknown): void => {
    if (typeof item === "string") {
      if (/^https?:\/\//i.test(item)) result.push(item);
    } else if (Array.isArray(item)) {
      for (const child of item) visit(child);
    } else if (item && typeof item === "object") {
      for (const child of Object.values(item)) visit(child);
    }
  };
  visit(value);
  return result;
}

function checkJsonLdUrls(value: unknown, scope: string): void {
  const urlKeys = new Set([
    "@id",
    "image",
    "logo",
    "mainentityofpage",
    "sameas",
    "target",
    "url",
    "urltemplate",
  ]);
  const localhostFields = new Set<string>();
  const mixedOrigins = new Map<string, Set<string>>();
  const invalidFields = new Set<string>();
  const relativeFields = new Set<string>();
  const visit = (item: unknown, key = ""): void => {
    if (typeof item === "string") {
      const lower = item.toLowerCase();
      const isCanonicalLocalUrl = isLocalOrigin(canonicalOrigin) && (() => {
        try { return new URL(item).origin === canonicalOrigin; } catch { return false; }
      })();
      if (!isCanonicalLocalUrl && (lower.includes("localhost") || lower.includes("127.0.0.1") || lower.includes("[::1]"))) {
        localhostFields.add(key || "a value");
        return;
      }

      const isContext = key.toLowerCase() === "@context";
      if (/^https?:\/\//i.test(item)) {
        try {
          const url = new URL(item);
          const schemaContext = isContext && (url.origin === "https://schema.org" || url.origin === "http://schema.org");
          if (!schemaContext && url.origin !== canonicalOrigin) {
            const fields = mixedOrigins.get(url.origin) || new Set<string>();
            fields.add(key || "a value");
            mixedOrigins.set(url.origin, fields);
          }
        } catch {
          invalidFields.add(key || "a value");
        }
      } else if (urlKeys.has(key.toLowerCase()) && item.trim()) {
        relativeFields.add(key);
      }
      return;
    }
    if (Array.isArray(item)) {
      for (const child of item) visit(child, key);
      return;
    }
    if (item && typeof item === "object") {
      for (const [childKey, child] of Object.entries(item)) visit(child, childKey);
    }
  };
  visit(value);
  if (localhostFields.size > 0) fail(scope, `JSON-LD contains localhost URL(s) in ${[...localhostFields].sort().join(", ")}`);
  for (const [origin, fields] of mixedOrigins) {
    fail(scope, `JSON-LD has mixed origin ${origin} in ${[...fields].sort().join(", ")}`);
  }
  if (invalidFields.size > 0) fail(scope, `JSON-LD contains invalid URL(s) in ${[...invalidFields].sort().join(", ")}`);
  if (relativeFields.size > 0) fail(scope, `JSON-LD URL(s) are not absolute in ${[...relativeFields].sort().join(", ")}`);
}

function checkSearchActions(value: unknown, scope: string): void {
  for (const object of jsonLdObjects(value)) {
    if (!typeIncludes(object["@type"], "SearchAction")) continue;

    const target = object.target;
    const targetObject = target && typeof target === "object" && !Array.isArray(target)
      ? target as Record<string, unknown>
      : undefined;
    const template = typeof target === "string"
      ? target
      : typeof targetObject?.urlTemplate === "string" ? targetObject.urlTemplate : undefined;
    if (!template) {
      fail(scope, "SearchAction has no URL template");
      continue;
    }
    if (!template.includes("{search_term_string}")) {
      fail(scope, "SearchAction URL template lacks {search_term_string}");
    }

    try {
      const url = new URL(template);
      if (url.origin !== canonicalOrigin) fail(scope, `SearchAction has mixed origin ${url.origin}`);
      if (url.pathname === "/api" || url.pathname.startsWith("/api/") || PRIVATE_PATHS.some(path => url.pathname === path || url.pathname.startsWith(`${path}/`))) {
        fail(scope, `SearchAction points at a private or API path ${url.pathname}`);
      }
    } catch {
      fail(scope, "SearchAction URL template is not an absolute URL");
    }

    const queryInput = object["query-input"];
    const queryText = typeof queryInput === "string" ? queryInput : JSON.stringify(queryInput ?? "");
    if (!queryText.includes("search_term_string")) {
      fail(scope, "SearchAction is missing query-input for search_term_string");
    }
  }
}

function checkJsonLdDates(value: unknown, scope: string): void {
  const dateKeys = new Set(["datepublished", "datemodified", "datecreated"]);
  const visit = (item: unknown): void => {
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }
    if (!item || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item)) {
      if (dateKeys.has(key.toLowerCase()) && typeof child === "string") {
        const timestamp = Date.parse(child);
        if (!Number.isFinite(timestamp)) fail(scope, `JSON-LD ${key} is not a valid date`);
        else if (timestamp > Date.now()) fail(scope, `JSON-LD ${key} is in the future`);
      }
      visit(child);
    }
  };
  visit(value);
}

async function checkPngImage(rawUrl: string, scope: string): Promise<void> {
  let imageUrl: URL;
  try {
    imageUrl = new URL(rawUrl);
  } catch {
    fail(scope, `invalid image URL ${rawUrl}`);
    return;
  }
  if (imageUrl.origin !== canonicalOrigin) {
    fail(scope, `image URL has mixed origin ${imageUrl.origin}`);
    return;
  }
  const canonicalImageUrl = imageUrl.href;
  if (checkedImages.has(canonicalImageUrl)) return;
  checkedImages.add(canonicalImageUrl);
  stats.images += 1;

  try {
    const response = await fetchWithTimeout(networkUrlForCanonical(canonicalImageUrl));
    if (isRedirect(response)) {
      fail(scope, `image redirected (${response.status})`);
      return;
    }
    const contentType = response.headers.get("content-type") || "";
    if (response.status !== 200 || !/^image\/png\b/i.test(contentType)) {
      fail(scope, `image ${describeResponse(response)}; expected 200 image/png`);
      return;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < pngSignature.length || !pngSignature.every((byte, index) => bytes[index] === byte)) {
      fail(scope, "image content is not a PNG signature");
    }
  } catch (error) {
    fail(scope, `image request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function canonicalPathFromUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    if (url.origin !== canonicalOrigin || url.search || url.hash) return undefined;
    return url.pathname;
  } catch {
    return undefined;
  }
}

async function checkArticleJsonLd(page: PublicPage): Promise<void> {
  const articleObjects = page.jsonLd
    .flatMap(document => jsonLdObjects(document))
    .filter(object => typeIncludes(object["@type"], "Article"));
  if (articleObjects.length !== 1) {
    fail(page.path, `expected exactly one Article JSON-LD object, found ${articleObjects.length}`);
    return;
  }

  const article = articleObjects[0];
  const headline = typeof article.headline === "string" ? textContent(article.headline) : "";
  if (!headline) fail(page.path, "Article JSON-LD has no headline");
  if (headline && headline !== page.h1) fail(page.path, "Article JSON-LD headline does not match the page h1");

  const imageUrls = stringUrls(article.image);
  const expectedImagePath = `${page.path}/opengraph-image`;
  const schemaImage = imageUrls.find(url => canonicalPathFromUrl(url) === expectedImagePath);
  if (!schemaImage) {
    fail(page.path, `Article JSON-LD image is not ${expectedImagePath}`);
  } else {
    await checkPngImage(schemaImage, `${page.path} schema image`);
  }

  const author = article.author;
  const authorName = typeof author === "string"
    ? author.trim()
    : author && typeof author === "object" && !Array.isArray(author) && typeof (author as Record<string, unknown>).name === "string"
      ? String((author as Record<string, unknown>).name).trim()
      : "";
  if (!authorName) fail(page.path, "Article JSON-LD has no author/byline");
  const byline = extractElements(page.html, "p").find(element =>
    (getAttribute(element.attrs, "class") || "").split(/\s+/).includes("article-byline"),
  );
  if (!byline || !textContent(byline.inner)) fail(page.path, "article page has no visible byline");
}

async function checkPublicPage(path: string): Promise<PublicPage | undefined> {
  const scope = path;
  let response: Response;
  try {
    response = await fetchWithTimeout(requestUrl(path));
  } catch (error) {
    fail(scope, `request failed: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
  if (isRedirect(response)) {
    fail(scope, `unexpected redirect (${response.status}) to ${response.headers.get("location") || "unknown"}`);
    return undefined;
  }
  const contentType = response.headers.get("content-type") || "";
  if (response.status !== 200 || !/^text\/html\b/i.test(contentType)) {
    fail(scope, `${describeResponse(response)}; expected 200 text/html`);
    return undefined;
  }

  const html = await response.text();
  checkPublicRobots(scope, html, response);

  const canonicalTags = extractStartTags(html, "link").filter(tag =>
    (getAttribute(tag, "rel") || "").toLowerCase().split(/\s+/).includes("canonical"),
  );
  if (canonicalTags.length !== 1) {
    fail(scope, `expected exactly one canonical link, found ${canonicalTags.length}`);
  } else {
    const actual = getAttribute(canonicalTags[0], "href");
    let actualUrl: URL | undefined;
    try {
      actualUrl = actual ? new URL(actual, requestUrl(path)) : undefined;
    } catch {
      actualUrl = undefined;
    }
    if (!actualUrl || actualUrl.href !== canonicalUrl(path)) {
      fail(scope, `canonical is ${actual || "missing"}; expected ${canonicalUrl(path)}`);
    }
  }

  const titles = extractElements(html, "title").map(element => textContent(element.inner));
  if (titles.length !== 1 || !titles[0]) fail(scope, `expected one non-empty title, found ${titles.length}`);
  const descriptions = extractStartTags(html, "meta")
    .filter(tag => (getAttribute(tag, "name") || "").toLowerCase() === "description")
    .map(tag => getAttribute(tag, "content") || "");
  if (descriptions.length !== 1 || !descriptions[0]) fail(scope, `expected one non-empty meta description, found ${descriptions.length}`);

  const h1s = extractElements(html, "h1");
  if (h1s.length !== 1 || !textContent(h1s[0]?.inner || "")) fail(scope, `expected one non-empty h1, found ${h1s.length}`);
  const h1 = textContent(h1s[0]?.inner || "");

  const jsonLd = jsonLdScripts(html, scope);
  for (const document of jsonLd) {
    checkJsonLdUrls(document, scope);
    checkSearchActions(document, scope);
    checkJsonLdDates(document, scope);
  }

  const ogImages = extractStartTags(html, "meta")
    .filter(tag => (getAttribute(tag, "property") || "").toLowerCase() === "og:image")
    .map(tag => getAttribute(tag, "content") || "")
    .filter(Boolean);
  if (path === "/blog" && ogImages.length === 0) fail(scope, "blog index has no og:image");
  for (const rawImage of ogImages) {
    try {
      const image = new URL(rawImage, requestUrl(path));
      if (image.origin !== canonicalOrigin) {
        fail(scope, `og:image has mixed origin ${image.origin}`);
      } else {
        await checkPngImage(image.href, `${scope} og:image`);
      }
    } catch {
      fail(scope, `og:image is not a valid URL: ${rawImage}`);
    }
  }

  const page: PublicPage = { path, html, response, h1, jsonLd };
  if (BLOG_SLUGS.some(slug => path === `/blog/${slug}`)) await checkArticleJsonLd(page);
  return page;
}

function xmlText(value: string): string {
  return decodeHtml(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).trim();
}

function xmlChild(block: string, name: string): string | undefined {
  const match = block.match(new RegExp(`<${escapeRegExp(name)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(name)}\\s*>`, "i"));
  return match ? xmlText(match[1] || "") : undefined;
}

function parseSitemap(xml: string, scope: string): SitemapEntry[] {
  if (!/<urlset\b/i.test(xml)) fail(scope, "response is not a sitemap urlset");
  const entries: SitemapEntry[] = [];
  const urlPattern = /<url\b[^>]*>([\s\S]*?)<\/url\s*>/gi;
  for (const match of xml.matchAll(urlPattern)) {
    const block = match[1] || "";
    const loc = xmlChild(block, "loc");
    if (!loc) {
      fail(scope, "sitemap entry has no loc");
      continue;
    }
    const imageUrls: string[] = [];
    const imagePattern = /<image:loc\b[^>]*>([\s\S]*?)<\/image:loc\s*>/gi;
    for (const imageMatch of block.matchAll(imagePattern)) imageUrls.push(xmlText(imageMatch[1] || ""));
    entries.push({ loc, lastmod: xmlChild(block, "lastmod"), images: imageUrls });
  }
  if (entries.length === 0) fail(scope, "sitemap has no url entries");
  return entries;
}

async function checkSitemap(): Promise<void> {
  const scope = "/sitemap.xml";
  let response: Response;
  try {
    response = await fetchWithTimeout(requestUrl(scope));
  } catch (error) {
    fail(scope, `request failed: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (isRedirect(response)) {
    fail(scope, `unexpected redirect (${response.status}) to ${response.headers.get("location") || "unknown"}`);
    return;
  }
  const contentType = response.headers.get("content-type") || "";
  if (response.status !== 200 || !/(?:application|text)\/xml\b/i.test(contentType)) {
    fail(scope, `${describeResponse(response)}; expected 200 XML`);
    return;
  }

  const entries = parseSitemap(await response.text(), scope);
  const expected = new Set(PUBLIC_PATHS);
  const seenPaths = new Set<string>();
  const seenLocs = new Set<string>();
  const nonCanonicalLocs: string[] = [];
  const unexpectedPaths: string[] = [];
  const repeatedPaths: string[] = [];
  const repeatedLocs: string[] = [];
  const nonCanonicalImages: string[] = [];
  const unexpectedImagePaths: string[] = [];
  for (const entry of entries) {
    const path = canonicalPathFromUrl(entry.loc);
    if (!path) {
      nonCanonicalLocs.push(entry.loc);
    } else if (!expected.has(path)) {
      unexpectedPaths.push(path);
    } else if (seenPaths.has(path)) {
      repeatedPaths.push(path);
    } else {
      seenPaths.add(path);
    }
    if (seenLocs.has(entry.loc)) repeatedLocs.push(entry.loc);
    seenLocs.add(entry.loc);

    if (entry.lastmod) {
      const date = Date.parse(entry.lastmod);
      if (!Number.isFinite(date)) fail(scope, `sitemap lastmod is invalid for ${entry.loc}`);
      else if (date > Date.now()) fail(scope, `sitemap lastmod is in the future for ${entry.loc}`);
    }

    for (const imageUrl of entry.images) {
      if (seenLocs.has(imageUrl)) repeatedLocs.push(imageUrl);
      seenLocs.add(imageUrl);
      const imagePath = canonicalPathFromUrl(imageUrl);
      if (!imagePath) {
        nonCanonicalImages.push(imageUrl);
        continue;
      }
      if (!imagePath.endsWith("/opengraph-image")) unexpectedImagePaths.push(imagePath);
      await checkPngImage(imageUrl, `${scope} image`);
    }
  }
  const missingPaths = [...expected].filter(path => !seenPaths.has(path));
  if (nonCanonicalLocs.length > 0) fail(scope, `non-canonical loc(s): ${nonCanonicalLocs.join(", ")}`);
  if (unexpectedPaths.length > 0) fail(scope, `unexpected path(s): ${unexpectedPaths.join(", ")}`);
  if (repeatedPaths.length > 0) fail(scope, `repeated path(s): ${repeatedPaths.join(", ")}`);
  if (repeatedLocs.length > 0) fail(scope, `repeated loc(s): ${repeatedLocs.join(", ")}`);
  if (nonCanonicalImages.length > 0) fail(scope, `non-canonical image loc(s): ${nonCanonicalImages.join(", ")}`);
  if (unexpectedImagePaths.length > 0) fail(scope, `unexpected image path(s): ${unexpectedImagePaths.join(", ")}`);
  if (missingPaths.length > 0) fail(scope, `missing path(s): ${missingPaths.join(", ")}`);
  if (entries.length !== PUBLIC_PATHS.length) {
    fail(scope, `expected exactly ${PUBLIC_PATHS.length} public URL entries, found ${entries.length}`);
  }
}

function parseRobotsGroups(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | undefined;
  let hasRule = false;
  const flush = (): void => {
    if (current && current.agents.length > 0) groups.push(current);
    current = undefined;
    hasRule = false;
  };

  for (const originalLine of text.split(/\r?\n/)) {
    const line = originalLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (hasRule) flush();
      current ||= { agents: [], rules: [] };
      current.agents.push(value.toLowerCase());
    } else if (field === "allow" || field === "disallow") {
      current ||= { agents: ["*"], rules: [] };
      current.rules.push({ kind: field, path: value });
      hasRule = true;
    }
  }
  flush();
  return groups;
}

function robotsRuleMatches(rulePath: string, path: string): boolean {
  if (!rulePath) return false;
  const endAnchored = rulePath.endsWith("$");
  const pattern = rulePath.replace(/\$$/, "").split("*").map(escapeRegExp).join(".*");
  return new RegExp(`^${pattern}${endAnchored ? "$" : ""}`).test(path);
}

function pathDisallowedByRobots(groups: RobotsGroup[], path: string): boolean {
  const wildcardGroups = groups.filter(group => group.agents.includes("*"));
  const rules = wildcardGroups.flatMap(group => group.rules);
  let bestLength = -1;
  let bestKind: RobotsRule["kind"] | undefined;
  for (const rule of rules) {
    if (!robotsRuleMatches(rule.path, path)) continue;
    const length = rule.path.replace(/[*$]/g, "").length;
    if (length > bestLength || (length === bestLength && rule.kind === "allow")) {
      bestLength = length;
      bestKind = rule.kind;
    }
  }
  return bestKind === "disallow";
}

async function checkRobots(): Promise<void> {
  const scope = "/robots.txt";
  let response: Response;
  try {
    response = await fetchWithTimeout(requestUrl(scope));
  } catch (error) {
    fail(scope, `request failed: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (isRedirect(response)) {
    fail(scope, `unexpected redirect (${response.status}) to ${response.headers.get("location") || "unknown"}`);
    return;
  }
  const contentType = response.headers.get("content-type") || "";
  if (response.status !== 200 || !/^text\/plain\b/i.test(contentType)) {
    fail(scope, `${describeResponse(response)}; expected 200 text/plain`);
    return;
  }
  const text = await response.text();
  const sitemapLines = text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^sitemap\s*:/i.test(line))
    .map(line => line.replace(/^sitemap\s*:\s*/i, "").trim());
  if (!sitemapLines.includes(canonicalUrl("/sitemap.xml"))) {
    fail(scope, `Sitemap directive must be ${canonicalUrl("/sitemap.xml")}`);
  }
  for (const sitemap of sitemapLines) {
    try {
      const url = new URL(sitemap);
      if (url.origin !== canonicalOrigin) fail(scope, `robots sitemap has mixed origin ${url.origin}`);
    } catch {
      fail(scope, `robots sitemap is not an absolute URL: ${sitemap}`);
    }
  }
  if (sitemapLines.length === 0) fail(scope, "robots.txt has no Sitemap directive");

  const groups = parseRobotsGroups(text);
  if (!groups.some(group => group.agents.includes("*"))) fail(scope, "robots.txt has no User-agent: * group");
  for (const path of PUBLIC_PATHS) {
    if (pathDisallowedByRobots(groups, path)) fail(scope, `robots.txt disallows public path ${path}`);
  }
}

async function checkLlms(): Promise<void> {
  const scope = "/llms.txt";
  let response: Response;
  try {
    response = await fetchWithTimeout(requestUrl(scope));
  } catch (error) {
    fail(scope, `request failed: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (isRedirect(response)) {
    fail(scope, `unexpected redirect (${response.status}) to ${response.headers.get("location") || "unknown"}`);
    return;
  }
  const contentType = response.headers.get("content-type") || "";
  if (response.status !== 200 || !/^text\/plain\b/i.test(contentType)) {
    fail(scope, `${describeResponse(response)}; expected 200 text/plain`);
    return;
  }
  const text = await response.text();
  const links = [...text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^)]*["'])?\)/g)].map(match => decodeHtml(match[1] || ""));
  const expected = new Set([...PUBLIC_PATHS, "/sitemap.xml"]);
  const linkedPaths = new Set<string>();
  const mixedOrigins = new Set<string>();
  const queryLinks: string[] = [];
  const unexpectedPaths = new Set<string>();
  const invalidLinks: string[] = [];
  if (links.length === 0) fail(scope, "llms.txt has no Markdown links");
  for (const rawLink of links) {
    try {
      const url = new URL(rawLink);
      if (url.origin !== canonicalOrigin) {
        mixedOrigins.add(url.origin);
        continue;
      }
      if (url.search || url.hash) queryLinks.push(rawLink);
      if (!expected.has(url.pathname)) unexpectedPaths.add(url.pathname);
      linkedPaths.add(url.pathname);
    } catch {
      invalidLinks.push(rawLink);
    }
  }
  const missingPaths = [...expected].filter(path => !linkedPaths.has(path));
  if (mixedOrigins.size > 0) fail(scope, `llms links have mixed origin(s): ${[...mixedOrigins].join(", ")}`);
  if (queryLinks.length > 0) fail(scope, `llms links have query/hash: ${queryLinks.join(", ")}`);
  if (unexpectedPaths.size > 0) fail(scope, `llms links have unexpected path(s): ${[...unexpectedPaths].join(", ")}`);
  if (invalidLinks.length > 0) fail(scope, `llms links are not absolute canonical URLs: ${invalidLinks.join(", ")}`);
  if (missingPaths.length > 0) fail(scope, `llms is missing path(s): ${missingPaths.join(", ")}`);
}

async function checkPrivateRoute(path: string): Promise<void> {
  const scope = path;
  let response: Response;
  try {
    response = await fetchWithTimeout(requestUrl(path));
  } catch (error) {
    fail(scope, `request failed: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  if (isRedirect(response)) {
    const location = response.headers.get("location");
    let redirectedUrl: URL | undefined;
    try {
      redirectedUrl = location ? new URL(location, requestUrl(path)) : undefined;
    } catch {
      redirectedUrl = undefined;
    }
    const redirectedPath = redirectedUrl?.pathname;
    if (!redirectedUrl || (redirectedUrl.origin !== requestOrigin && redirectedUrl.origin !== canonicalOrigin) || redirectedPath !== "/login") {
      fail(scope, `private route redirects to ${location || "nowhere"}; expected /login`);
    }
    return;
  }
  const contentType = response.headers.get("content-type") || "";
  if (response.status !== 200 || !/^text\/html\b/i.test(contentType)) {
    fail(scope, `${describeResponse(response)}; expected 200 HTML with noindex or a redirect to /login`);
    return;
  }
  const html = await response.text();
  checkNoindex(scope, html, response);
}

async function checkAuthRoute(path: string): Promise<void> {
  const scope = path;
  let response: Response;
  try {
    response = await fetchWithTimeout(requestUrl(path));
  } catch (error) {
    fail(scope, `request failed: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (isRedirect(response)) {
    fail(scope, `auth page unexpectedly redirects (${response.status}) to ${response.headers.get("location") || "unknown"}`);
    return;
  }
  const contentType = response.headers.get("content-type") || "";
  if (response.status !== 200 || !/^text\/html\b/i.test(contentType)) {
    fail(scope, `${describeResponse(response)}; expected 200 text/html with noindex`);
    return;
  }
  const html = await response.text();
  checkNoindex(scope, html, response);
}

async function checkUnknownBlogSlug(): Promise<void> {
  const path = "/blog/seo-smoke-not-a-real-slug";
  const scope = "unknown blog slug";
  let response: Response;
  try {
    response = await fetchWithTimeout(requestUrl(path));
  } catch (error) {
    fail(scope, `request failed: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (isRedirect(response)) {
    fail(scope, `unknown blog slug redirects (${response.status}) to ${response.headers.get("location") || "unknown"}`);
  } else if (response.status !== 404) {
    fail(scope, `expected 404, got ${describeResponse(response)}`);
  }
}

function checkUniquePageMetadata(pages: PublicPage[]): void {
  const titles = new Map<string, string[]>();
  const descriptions = new Map<string, string[]>();
  for (const page of pages) {
    const title = textContent(extractElements(page.html, "title")[0]?.inner || "").toLowerCase();
    const description = extractStartTags(page.html, "meta")
      .find(tag => (getAttribute(tag, "name") || "").toLowerCase() === "description");
    const descriptionText = (getAttribute(description || "", "content") || "").trim().toLowerCase();
    if (title) titles.set(title, [...(titles.get(title) || []), page.path]);
    if (descriptionText) descriptions.set(descriptionText, [...(descriptions.get(descriptionText) || []), page.path]);
  }
  for (const [title, paths] of titles) {
    if (paths.length > 1) fail("public metadata", `duplicate title across ${paths.join(", ")}: ${title}`);
  }
  for (const [description, paths] of descriptions) {
    if (paths.length > 1) fail("public metadata", `duplicate description across ${paths.join(", ")}: ${description}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length > 2 || args.includes("--help") || args.includes("-h")) {
    console.error("Usage: npx tsx scripts/check-seo.ts [request-origin] [canonical-origin]");
    if (args.length > 2) process.exitCode = 2;
    return;
  }

  const parsedRequest = normalizeOrigin(args[0] || PRODUCTION_ORIGIN, "request origin");
  if (!parsedRequest) {
    process.exitCode = 2;
    return;
  }
  const defaultCanonical = isLocalOrigin(parsedRequest) ? PRODUCTION_ORIGIN : parsedRequest;
  const parsedCanonical = normalizeOrigin(args[1] || defaultCanonical, "canonical origin");
  if (!parsedCanonical) {
    process.exitCode = 2;
    return;
  }
  requestOrigin = parsedRequest;
  canonicalOrigin = parsedCanonical;

  const pages = (await Promise.all(PUBLIC_PATHS.map(path => checkPublicPage(path)))).filter(
    (page): page is PublicPage => Boolean(page),
  );
  stats.publicPages = pages.length;
  checkUniquePageMetadata(pages);

  await Promise.all([
    checkSitemap(),
    checkRobots(),
    checkLlms(),
    checkUnknownBlogSlug(),
    ...AUTH_PATHS.map(path => checkAuthRoute(path)),
    ...PRIVATE_PATHS.map(path => checkPrivateRoute(path)),
  ]);

  const mode = requestOrigin === canonicalOrigin
    ? requestOrigin
    : `${requestOrigin} (canonical ${canonicalOrigin})`;
  if (failures.length > 0) {
    failures.sort((left, right) => left.scope.localeCompare(right.scope) || left.message.localeCompare(right.message));
    console.error(`SEO smoke test failed for ${mode}: ${failures.length} issue(s)`);
    for (const failure of failures) console.error(`FAIL ${failure.scope}: ${failure.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`SEO smoke test passed for ${mode}: ${stats.publicPages} public pages, ${stats.images} PNG images, ${stats.jsonLdDocuments} JSON-LD documents, sitemap, robots, llms, and private-route checks.`);
}

main().catch(error => {
  console.error(`SEO smoke test aborted: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
