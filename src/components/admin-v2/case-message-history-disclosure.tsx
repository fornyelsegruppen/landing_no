"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function hashTargetIdFromFragment(fragment: string) {
  try {
    return decodeURIComponent(fragment.slice(1));
  } catch {
    return null;
  }
}

export function CaseMessageHistoryDisclosure({
  children,
  summary,
}: {
  children: ReactNode;
  summary: string;
}) {
  const disclosureRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const revealHashTarget = () => {
      const targetId = hashTargetIdFromFragment(window.location.hash);
      const target = targetId ? document.getElementById(targetId) : null;

      if (target && disclosureRef.current?.contains(target)) {
        disclosureRef.current.open = true;
      }
    };

    revealHashTarget();
    window.addEventListener("hashchange", revealHashTarget);
    return () => window.removeEventListener("hashchange", revealHashTarget);
  }, []);

  return (
    <details
      className="rounded-2xl border border-white/10 bg-black/10 p-4"
      ref={disclosureRef}
    >
      <summary className="hover:text-accent cursor-pointer font-semibold">
        {summary}
      </summary>
      <div className="mt-3 grid min-w-0 gap-3">{children}</div>
    </details>
  );
}
