"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import type { FolderItem } from "@/lib/docs";

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function TreeNode({
  item,
  folderMap,
  activeSlug,
  depth,
}: {
  item: FolderItem;
  folderMap: Record<string, FolderItem[]>;
  activeSlug: string;
  depth: number;
}) {
  const children = item.type === "folder" ? (folderMap[item.slug] ?? []) : [];
  const isActive = activeSlug === item.slug;
  const isAncestor = activeSlug.startsWith(item.slug + "/");

  // Depth 0: version folder (e.g. v0.1) — render as version badge + expand children
  if (depth === 0 && item.type === "folder") {
    return (
      <li className="mb-3">
        <Link href={`/${item.slug}`} className="mb-2 block px-2">
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-indigo-600 transition-colors hover:border-indigo-300 hover:bg-indigo-100">
            {item.name}
          </span>
        </Link>
        {children.length > 0 && (
          <ul className="space-y-0.5">
            {children.map((child) => (
              <TreeNode
                key={child.slug}
                item={child}
                folderMap={folderMap}
                activeSlug={activeSlug}
                depth={1}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // Depth 1: section folder (e.g. prd, tech, claude-code) — section header
  if (depth === 1 && item.type === "folder") {
    const sectionOpen = isActive || isAncestor;
    return (
      <li className="mb-0.5">
        <Link
          href={`/${item.slug}`}
          className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors duration-150
            ${sectionOpen ? "text-slate-800" : "text-slate-400 hover:text-slate-600"}`}
        >
          <ChevronIcon
            className={`h-2.5 w-2.5 shrink-0 transition-transform duration-150
              ${sectionOpen ? "rotate-90 text-indigo-500" : "text-slate-300"}`}
          />
          {item.name}
        </Link>
        {children.length > 0 && (
          <ul className="mb-1 ml-[13px] mt-0.5 space-y-0.5 border-l border-slate-100 pl-3">
            {children.map((child) => (
              <TreeNode
                key={child.slug}
                item={child}
                folderMap={folderMap}
                activeSlug={activeSlug}
                depth={2}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // Deeper folders
  if (item.type === "folder") {
    const sectionOpen = isActive || isAncestor;
    return (
      <li>
        <Link
          href={`/${item.slug}`}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors
            ${sectionOpen ? "font-medium text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
        >
          <ChevronIcon
            className={`h-2.5 w-2.5 shrink-0 transition-transform duration-150
              ${sectionOpen ? "rotate-90 text-indigo-500" : "text-slate-300"}`}
          />
          {item.name}
        </Link>
        {children.length > 0 && (
          <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-100 pl-3">
            {children.map((child) => (
              <TreeNode
                key={child.slug}
                item={child}
                folderMap={folderMap}
                activeSlug={activeSlug}
                depth={depth + 1}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // File item
  return (
    <li>
      <Link
        href={`/${item.slug}`}
        className={`block truncate rounded-md py-1.5 pl-3 pr-2 text-sm transition-colors duration-100
          ${isActive
            ? "bg-indigo-50 font-medium text-indigo-700 ring-1 ring-inset ring-indigo-100"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
      >
        {item.title ?? item.name}
      </Link>
    </li>
  );
}

function FullTree({
  folderMap,
  activeSlug,
}: {
  folderMap: Record<string, FolderItem[]>;
  activeSlug: string;
}) {
  const roots = folderMap[""] ?? [];
  return (
    <ul className="space-y-0.5">
      {roots.map((item) => (
        <TreeNode
          key={item.slug}
          item={item}
          folderMap={folderMap}
          activeSlug={activeSlug}
          depth={0}
        />
      ))}
    </ul>
  );
}

interface Props {
  folderMap: Record<string, FolderItem[]>;
  dirSlugs: string[];
}

export default function SmartSidebar({ folderMap }: Props) {
  const pathname = usePathname();
  const slug = pathname === "/" ? "" : pathname.slice(1);

  return (
    <nav>
      <FullTree folderMap={folderMap} activeSlug={slug} />
    </nav>
  );
}
