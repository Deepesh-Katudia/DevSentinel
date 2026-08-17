import { AppShell } from "./app-shell";

// Every route under (app) is auth-gated and user-specific, so there is nothing
// meaningful to prerender: without a session they all redirect to /login.
//
// Static export is also actively harmful here. Prerendering renders the tree
// server-side at build time, which runs AuthProvider's body, which builds a
// Supabase browser client from NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY. Those are
// inlined at build time, so when they are absent from the build environment the
// client constructor throws and the whole build fails on a page no logged-out
// visitor could ever see.
//
// This has to live in a server component. Route segment config is silently
// ignored in "use client" files -- setting it on the page components left them
// marked (Static) in the build output -- so the layout stays a server component
// and the interactive shell moved to ./app-shell.tsx.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
