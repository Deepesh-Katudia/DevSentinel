import { AppNav } from "@/components/layout/app-nav";
import { Footer } from "@/components/ui/footer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppNav />
      <main className="flex-1 max-w-6xl mx-auto w-full px-8 py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
