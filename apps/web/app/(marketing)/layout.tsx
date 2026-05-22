import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { ShieldCheck } from "lucide-react";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <nav className="h-[60px] flex items-center px-10 border-b border-[var(--border)] bg-[rgba(237,237,233,0.9)] backdrop-blur-md sticky top-0 z-50">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-serif text-[20px] font-bold text-[var(--ink)]"
        >
          <span className="w-8 h-8 bg-[var(--ink)] rounded-[7px] flex items-center justify-center">
            <ShieldCheck size={16} className="text-[var(--bg)]" />
          </span>
          DevSentinel
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <Link
            href="/features"
            className="text-[14px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
          >
            Features
          </Link>
          <Link
            href="/pricing"
            className="text-[14px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/docs"
            className="text-[14px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
          >
            Docs
          </Link>
          <Button asChild size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </nav>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
