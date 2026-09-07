import fs from "fs";
import path from "path";
import matter from "gray-matter";

export type InsightFrontmatter = {
  title: string;
  date: string;
  slug: string;
  summary: string;
  author?: string;
  tags?: string[];
  status?: string;
};

export type InsightPost = InsightFrontmatter & {
  body: string;
};

const INSIGHTS_DIR = path.join(process.cwd(), "content/insights");
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SKIP_FILES = new Set(["readme.md"]);

/** Public list/detail: omit status, or status ready/published. Drafts stay off the site. */
const PUBLIC_STATUSES = new Set(["ready", "published"]);

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** gray-matter/js-yaml may parse unquoted YYYY-MM-DD as a Date; coerce to calendar string. */
function normalizeDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (DATE_RE.test(s)) return s;
    // ISO datetime → calendar date prefix
    const prefix = s.slice(0, 10);
    if (DATE_RE.test(prefix)) return prefix;
  }
  return null;
}

function normalizeTags(v: unknown): string[] | undefined {
  if (v == null) return undefined;
  if (!Array.isArray(v)) return undefined;
  const tags = v
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length ? tags : undefined;
}

function isPublicPost(post: InsightPost): boolean {
  if (post.status == null || post.status === "") return true;
  return PUBLIC_STATUSES.has(post.status.toLowerCase());
}

function parseInsightFile(filePath: string): InsightPost | null {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const stem = path.basename(filePath, ".md");

  if (!isNonEmptyString(data.title)) return null;
  const date = normalizeDate(data.date);
  if (!date || !DATE_RE.test(date)) return null;
  if (!isNonEmptyString(data.slug) || !SLUG_RE.test(data.slug.trim())) return null;
  if (!isNonEmptyString(data.summary)) return null;
  if (data.slug.trim() !== stem) return null;

  const author = isNonEmptyString(data.author) ? data.author.trim() : undefined;
  const status = isNonEmptyString(data.status) ? data.status.trim() : undefined;

  return {
    title: data.title.trim(),
    date,
    slug: data.slug.trim(),
    summary: data.summary.trim(),
    author,
    tags: normalizeTags(data.tags),
    status,
    body: content.replace(/^\uFEFF?/, "").trimStart(),
  };
}

function listInsightFiles(): string[] {
  if (!fs.existsSync(INSIGHTS_DIR)) return [];
  return fs
    .readdirSync(INSIGHTS_DIR)
    .filter((name) => name.endsWith(".md") && !SKIP_FILES.has(name.toLowerCase()))
    .map((name) => path.join(INSIGHTS_DIR, name));
}

/** Valid public posts only, newest date first (then slug). */
export function getInsightPosts(): InsightPost[] {
  const posts: InsightPost[] = [];
  for (const file of listInsightFiles()) {
    try {
      const post = parseInsightFile(file);
      if (post && isPublicPost(post)) posts.push(post);
    } catch {
      // Skip unreadable / invalid drafts so the list stays up.
    }
  }
  posts.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.slug.localeCompare(b.slug);
  });
  return posts;
}

export function getInsightBySlug(slug: string): InsightPost | null {
  if (!SLUG_RE.test(slug)) return null;
  const filePath = path.join(INSIGHTS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const post = parseInsightFile(filePath);
    if (!post || !isPublicPost(post)) return null;
    return post;
  } catch {
    return null;
  }
}

export function getInsightSlugs(): string[] {
  return getInsightPosts().map((p) => p.slug);
}
