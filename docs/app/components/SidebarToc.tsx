"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface Heading {
  text: string;
  id: string;
  level: number;
}

interface Group {
  parent: Heading;
  children: Heading[];
  standalone: boolean; // true for h1 — shown flat, no dropdown
}

function buildGroups(headings: Heading[]): Group[] {
  const groups: Group[] = [];

  for (const h of headings) {
    if (h.level === 1) {
      // h1 = standalone, never wraps children
      groups.push({ parent: h, children: [], standalone: true });
    } else if (h.level === 2) {
      // h2 = collapsible group parent
      groups.push({ parent: h, children: [], standalone: false });
    } else {
      // h3+ = child of the last non-standalone group
      const last = [...groups].reverse().find((g) => !g.standalone);
      if (last) last.children.push(h);
    }
  }
  return groups;
}

function scrollTo(id: string, setActiveId: (id: string) => void) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  setActiveId(id);
}

export default function SidebarToc() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  // Scan headings from the rendered article on each navigation
  useEffect(() => {
    const article = document.querySelector("article");
    if (!article) {
      setHeadings([]);
      return;
    }

    const els = article.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const found: Heading[] = [];
    const idCounts: Record<string, number> = {};

    els.forEach((el) => {
      const level = parseInt(el.tagName[1], 10);
      const text = el.textContent ?? "";
      const base = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");

      idCounts[base] = (idCounts[base] ?? 0) + 1;
      const id = idCounts[base] > 1 ? `${base}-${idCounts[base]}` : base;
      if (!el.id) el.id = id;
      found.push({ text, id: el.id, level });
    });

    setHeadings(found);
    setActiveId(found[0]?.id ?? "");

    // Open all groups by default
    const groups = buildGroups(found);
    setOpenGroups(new Set(groups.map((g) => g.parent.id)));
  }, [pathname]);

  // Highlight heading currently in view
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0 }
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  const groups = buildGroups(headings);
  const minLevel = Math.min(...headings.map((h) => h.level));

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="mt-6 border-t border-gray-100 pt-4">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        On this page
      </p>

      <ul className="space-y-0.5">
        {groups.map((group) => {
          const isOpen = openGroups.has(group.parent.id);
          const hasChildren = group.children.length > 0;

          return (
            <li key={group.parent.id}>
              {/* h1 — flat link, no dropdown */}
              {group.standalone ? (
                <a
                  href={`#${group.parent.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo(group.parent.id, setActiveId);
                  }}
                  className={`block rounded-md px-3 py-1 text-sm font-semibold transition-colors ${
                    activeId === group.parent.id
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-800 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {group.parent.text}
                </a>
              ) : (
                <>
                  {/* h2 — collapsible group header */}
                  <div className="flex items-center">
                    <a
                      href={`#${group.parent.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        scrollTo(group.parent.id, setActiveId);
                      }}
                      className={`flex-1 rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                        activeId === group.parent.id
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      {group.parent.text}
                    </a>

                    {hasChildren && (
                      <button
                        onClick={() => toggleGroup(group.parent.id)}
                        className="mr-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label={isOpen ? "Collapse" : "Expand"}
                      >
                        <svg
                          className={`h-3 w-3 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* h3+ children */}
                  {hasChildren && isOpen && (
                    <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-100">
                      {group.children.map((child, i) => (
                        <li
                          key={`${child.id}-${i}`}
                          style={{ paddingLeft: `${(child.level - 3) * 10 + 8}px` }}
                        >
                          <a
                            href={`#${child.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              scrollTo(child.id, setActiveId);
                            }}
                            className={`block rounded-md px-2 py-1 text-sm transition-colors ${
                              activeId === child.id
                                ? "bg-blue-50 font-medium text-blue-600"
                                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                            }`}
                          >
                            {child.text}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
