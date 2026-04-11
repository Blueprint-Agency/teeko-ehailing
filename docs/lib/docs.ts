import fs from "fs";
import path from "path";

// DOCS_ROOT is set in next.config.mjs via __dirname (reliable path to docs/)
const DOCS_DIR = process.env.DOCS_ROOT ?? process.cwd();

const EXCLUDED = new Set([
  "node_modules",
  ".next",
  ".vercel",
  "app",
  "lib",
  "components",
  "out",
  "public",
  "styles",
]);

export interface FolderItem {
  name: string;
  slug: string;
  type: "folder" | "file";
  title?: string;
  count?: number;
}

export interface DocFile {
  slug: string;
  title: string;
  category: string;
}

function parseTitleFromContent(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)/m);
  return match
    ? match[1].replace(/[*_`]/g, "")
    : fallback.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** List items (folders + md files) at a given slug path. Empty array = root. */
export function getFolderContents(slugParts: string[]): FolderItem[] {
  const dir = path.join(DOCS_DIR, ...slugParts);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: FolderItem[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || EXCLUDED.has(entry.name)) continue;

    if (entry.isDirectory()) {
      const subDir = path.join(dir, entry.name);
      const subEntries = fs.readdirSync(subDir, { withFileTypes: true });
      const count = subEntries.filter(
        (e) => !e.name.startsWith(".") && !EXCLUDED.has(e.name)
      ).length;
      results.push({
        name: entry.name,
        slug: [...slugParts, entry.name].join("/"),
        type: "folder",
        count,
      });
    } else if (entry.name.endsWith(".md")) {
      const content = fs.readFileSync(path.join(dir, entry.name), "utf-8");
      const nameWithoutExt = entry.name.replace(/\.md$/, "");
      results.push({
        name: nameWithoutExt,
        slug: [...slugParts, nameWithoutExt].join("/"),
        type: "file",
        title: parseTitleFromContent(content, nameWithoutExt),
      });
    }
  }

  return results;
}

/** True if the slug resolves to a directory. */
export function isDirectory(slugParts: string[]): boolean {
  const p = path.join(DOCS_DIR, ...slugParts);
  return fs.existsSync(p) && fs.statSync(p).isDirectory();
}

/** Read a markdown file's content. */
export function getDocContent(slugParts: string[]): string | null {
  const filePath = path.join(DOCS_DIR, ...slugParts) + ".md";
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

/** Pre-built map of every folder slug → its direct children (for the sidebar). */
export function buildFolderMap(): Record<string, FolderItem[]> {
  const map: Record<string, FolderItem[]> = {};
  map[""] = getFolderContents([]);

  function walk(slugParts: string[]) {
    const items = getFolderContents(slugParts);
    map[slugParts.join("/")] = items;
    for (const item of items) {
      if (item.type === "folder") walk(item.slug.split("/"));
    }
  }

  for (const item of map[""]) {
    if (item.type === "folder") walk(item.slug.split("/"));
  }

  return map;
}

/** All slugs (folders + files) for generateStaticParams. */
export function getAllSlugs(): string[][] {
  const results: string[][] = [];

  function scan(dir: string, parts: string[]) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || EXCLUDED.has(entry.name)) continue;
      if (entry.isDirectory()) {
        results.push([...parts, entry.name]);
        scan(path.join(dir, entry.name), [...parts, entry.name]);
      } else if (entry.name.endsWith(".md")) {
        results.push([...parts, entry.name.replace(/\.md$/, "")]);
      }
    }
  }

  scan(DOCS_DIR, []);
  return results;
}

/** Flat doc list for the sidebar, grouped by category path. */
export function getAllDocs(): DocFile[] {
  const results: DocFile[] = [];

  function scan(dir: string, parts: string[]) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || EXCLUDED.has(entry.name)) continue;
      if (entry.isDirectory()) {
        scan(path.join(dir, entry.name), [...parts, entry.name]);
      } else if (entry.name.endsWith(".md")) {
        const content = fs.readFileSync(
          path.join(dir, entry.name),
          "utf-8"
        );
        const nameWithoutExt = entry.name.replace(/\.md$/, "");
        results.push({
          slug: [...parts, nameWithoutExt].join("/"),
          title: parseTitleFromContent(content, nameWithoutExt),
          category: parts.join("/") || "General",
        });
      }
    }
  }

  scan(DOCS_DIR, []);
  return results;
}

export function getDocsByCategory(): Record<string, DocFile[]> {
  const docs = getAllDocs();
  const grouped: Record<string, DocFile[]> = {};
  for (const doc of docs) {
    if (!grouped[doc.category]) grouped[doc.category] = [];
    grouped[doc.category].push(doc);
  }
  return grouped;
}
