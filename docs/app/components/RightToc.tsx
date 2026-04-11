"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface Heading {
  text: string;
  id: string;
  level: number;
}

export default function RightToc() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState("");

  // Read IDs that are stamped on headings at render time by the heading components
  useEffect(() => {
    const article = document.querySelector("article");
    if (!article) {
      setHeadings([]);
      return;
    }

    const els = article.querySelectorAll<HTMLElement>("h2[id]");
    const found: Heading[] = [];

    els.forEach((el) => {
      found.push({
        text: el.textContent ?? "",
        id: el.id,
        level: parseInt(el.tagName[1], 10),
      });
    });

    setHeadings(found);
    setActiveId(found[0]?.id ?? "");
  }, [pathname]);

  // Track active heading as user scrolls
  useEffect(() => {
    if (!headings.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActiveId(e.target.id);
            break;
          }
        }
      },
      { rootMargin: "0px 0px -60% 0px", threshold: 0 }
    );
    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (!headings.length) return null;

  return (
    <aside className="sticky top-10 hidden xl:block">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
        On this page
      </p>
      <ul className="space-y-1.5 border-l border-slate-100 pl-4">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" });
                setActiveId(h.id);
              }}
              className={`block text-sm leading-snug transition-colors duration-100
                ${activeId === h.id
                  ? "font-medium text-indigo-600"
                  : "text-slate-400 hover:text-slate-700"
                }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
