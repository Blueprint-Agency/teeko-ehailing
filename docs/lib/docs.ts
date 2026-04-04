import fs from "fs";
import path from "path";

const DOCS_DIR = process.cwd();
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  ".vercel",
  "app",
  "lib",
  "components",
  "out",
  "public",
]);

export interface DocFile {
  slug: string;
  title: string;
  category: string;
}

function scanMarkdownFiles(dir: string, basePath = ""): DocFile[] {
  const results: DocFile[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".") || EXCLUDED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      results.push(...scanMarkdownFiles(fullPath, relativePath));
    } else if (entry.name.endsWith(".md")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      const titleMatch = content.match(/^#\s+(.+)/m);
      const slug = relativePath.replace(/\.md$/, "");

      results.push({
        slug,
        title: titleMatch
          ? titleMatch[1].replace(/[*_`]/g, "")
          : entry.name
              .replace(/\.md$/, "")
              .replace(/-/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()),
        category: basePath || "General",
      });
    }
  }

  return results;
}

export function getAllDocs(): DocFile[] {
  return scanMarkdownFiles(DOCS_DIR);
}

export function getDocContent(slug: string): string | null {
  const filePath = path.join(DOCS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
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
