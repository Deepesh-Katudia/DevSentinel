"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AppNav } from "@/components/layout/app-nav";
import { Footer } from "@/components/ui/footer";
import { OrgProvider, useOrg } from "@/contexts/org-context";

function OrgGuard({ children }: { children: React.ReactNode }) {
  const { org, isLoading } = useOrg();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !org && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [isLoading, org, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!org && pathname !== "/onboarding") return null;

  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrgProvider>
      <div className="min-h-screen flex flex-col bg-[var(--bg)]">
        <AppNav />
        <OrgGuard>
          <main className="flex-1 max-w-6xl mx-auto w-full px-8 py-8">
            {children}
          </main>
        </OrgGuard>
        <Footer />
      </div>
    </OrgProvider>
  );
}
