"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Clock } from "lucide-react";

function ComingSoonContent() {
  const params = useSearchParams();
  const name = params.get("name") ?? "This page";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 animate-fade-up"
        style={{ background: "#e3d5ca", border: "1px solid #c8b5a8" }}
      >
        <Clock size={28} style={{ color: "#d97706" }} />
      </div>

      <h1 className="font-serif text-4xl font-bold text-[var(--ink)] mb-3 animate-fade-up-1">
        {name} is coming soon
      </h1>
      <p className="text-[var(--ink-3)] text-[15px] max-w-sm leading-relaxed animate-fade-up-2">
        We're working on it. DevSentinel is moving fast — check back shortly or
        follow us for updates.
      </p>

      <div className="flex items-center gap-4 mt-8 animate-fade-up-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[14px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to home
        </Link>
        <a
          href="https://github.com/Deepesh-Katudia/DevSentinel"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[14px] text-amber-700 hover:text-amber-800 transition-colors"
        >
          Star us on GitHub →
        </a>
      </div>
    </div>
  );
}

export default function ComingSoonPage() {
  return (
    <Suspense>
      <ComingSoonContent />
    </Suspense>
  );
}
