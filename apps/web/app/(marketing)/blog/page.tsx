"use client";

import { useState } from "react";
import { useInView } from "@/hooks/use-in-view";

interface BlogPost {
  category: string;
  title: string;
  date: string;
  excerpt: string;
  slug: string;
}

const POSTS: BlogPost[] = [
  {
    slug: "ai-code-review-catches-what-humans-miss",
    category: "AI Code Review",
    title: "Why AI Code Review Catches What Humans Miss",
    date: "May 12, 2026",
    excerpt:
      "Human reviewers are great at architecture discussions but miss subtle type coercions, off-by-one errors, and security edge cases at 11 PM. Here's how Claude approaches code review differently.",
  },
  {
    slug: "sentry-alert-to-resolved-incident-3-minutes",
    category: "Incident Management",
    title: "From Sentry Alert to Resolved Incident in 3 Minutes",
    date: "April 28, 2026",
    excerpt:
      "Most teams spend the first 15 minutes of an incident just figuring out what went wrong. DevSentinel's AI triage cuts that to seconds — here's exactly how.",
  },
  {
    slug: "multi-tenant-saas-supabase-lessons-learned",
    category: "Engineering",
    title: "Building a Multi-tenant SaaS on Supabase: Lessons Learned",
    date: "March 15, 2026",
    excerpt:
      "Row-level security, org-scoped JWTs, and onboarding flows that don't confuse users. Everything we learned building DevSentinel's auth system from scratch.",
  },
];

function BlogCard({ post, index }: { post: BlogPost; index: number }) {
  const { ref, inView } = useInView();

  return (
    <div
      ref={ref}
      className={`
        flex flex-col gap-4 p-6
        bg-[var(--surface)] border border-[var(--border)] rounded-2xl
        hover:border-amber-600/40 hover:-translate-y-0.5 transition-all duration-200
        transition-opacity duration-700
        ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}
      `}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <span className="inline-flex self-start px-3 py-1 rounded-full text-xs font-medium bg-amber-600/10 text-amber-700 border border-amber-600/20">
        {post.category}
      </span>
      <h2 className="font-serif text-xl font-bold leading-snug text-[var(--ink)]">
        {post.title}
      </h2>
      <p className="text-xs text-[var(--ink-4)]">{post.date}</p>
      <p className="text-sm text-[var(--ink-3)] leading-relaxed flex-1">
        {post.excerpt}
      </p>
      <a
        href={`/blog/${post.slug}`}
        className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
      >
        Read more →
      </a>
    </div>
  );
}

export default function BlogPage() {
  const [email, setEmail] = useState("");
  const { ref: ctaRef, inView: ctaInView } = useInView();

  return (
    <div className="bg-[var(--bg)] text-[var(--ink)]">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-20 max-w-2xl mx-auto">
        <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight animate-fade-up">
          From the DevSentinel blog
        </h1>
        <p className="mt-5 text-[var(--ink-3)] text-lg leading-relaxed animate-fade-up-1">
          Thoughts on AI, code quality, and incident management.
        </p>
      </section>

      {/* Posts grid */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {POSTS.map((post, i) => (
            <BlogCard key={post.slug} post={post} index={i} />
          ))}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section
        ref={ctaRef}
        className={`
          px-6 pb-28 max-w-xl mx-auto
          transition-all duration-700
          ${ctaInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
      >
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 flex flex-col items-center text-center gap-5">
          <h2 className="font-serif text-2xl font-bold">
            Get notified when we publish
          </h2>
          <p className="text-sm text-[var(--ink-3)]">
            New articles on AI, developer tooling, and engineering best
            practices — no spam, ever.
          </p>
          <div className="flex w-full gap-2 max-w-sm">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="
                flex-1 h-10 px-3 rounded-lg text-sm
                bg-[var(--card)] border border-[var(--border)]
                text-[var(--ink)] placeholder:text-[var(--ink-4)]
                focus:outline-none focus:border-amber-600/50
                transition-colors duration-200
              "
            />
            <button
              type="button"
              className="
                h-10 px-4 rounded-lg text-sm font-medium
                bg-amber-600 hover:bg-amber-700 text-white
                transition-colors duration-200 whitespace-nowrap
              "
            >
              Subscribe
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
