"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MoveRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import InteractiveHoverButton from "@/components/ui/interactive-hover-button";

function Hero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["risky PRs", "Sentry alerts", "incident context", "quality trends"],
    []
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setTitleNumber((prev) => (prev === titles.length - 1 ? 0 : prev + 1));
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <div className="w-full">
      <div className="container mx-auto">
        <div className="flex flex-col items-center justify-center gap-8 py-20 lg:py-32">
          <Link
            href="/changelog"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-[12px] font-semibold text-[var(--ink-3)] transition-colors hover:border-[var(--ink-4)] hover:text-[var(--ink)]"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--pos)]" />
            Beta for GitHub + Sentry teams
            <MoveRight className="h-3.5 w-3.5" />
          </Link>

          <div className="flex flex-col gap-4">
            <h1 className="max-w-3xl text-center font-serif text-5xl font-bold tracking-tight text-[var(--ink)] md:text-7xl">
              <span>Review</span>
              <span className="relative flex w-full justify-center overflow-hidden text-center md:pb-4 md:pt-1">
                &nbsp;
                {titles.map((title, index) => (
                  <motion.span
                    key={index}
                    className="absolute font-bold text-[var(--graph)]"
                    initial={{ opacity: 0, y: -100 }}
                    transition={{ type: "spring", stiffness: 50 }}
                    animate={
                      titleNumber === index
                        ? { y: 0, opacity: 1 }
                        : { y: titleNumber > index ? -150 : 150, opacity: 0 }
                    }
                  >
                    {title}
                  </motion.span>
                ))}
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-center text-lg leading-relaxed tracking-tight text-[var(--ink-3)] md:text-xl">
              DevSentinel adds Claude-powered review to your GitHub pull requests
              and turns Sentry alerts into structured incident rooms with likely
              root cause, affected files, severity, and suggested fixes.
            </p>
          </div>

          <div className="flex flex-row gap-3">
            <Button size="lg" variant="outline" asChild>
              <Link href="/pricing">See pricing</Link>
            </Button>
            <Link href="/sign-up">
              <InteractiveHoverButton
                text="Start free"
                className="h-10 px-8 text-[15px]"
              />
            </Link>
          </div>
          <p className="max-w-xl text-center text-[13px] text-[var(--ink-4)]">
            Works with GitHub pull requests, Sentry webhooks, and your existing
            incident workflow.
          </p>
        </div>
      </div>
    </div>
  );
}

export { Hero };
