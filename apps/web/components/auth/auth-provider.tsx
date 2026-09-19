"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { isSameSession } from "@/lib/session";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Keep the previous object when nothing meaningful changed, so returning
    // to the tab (which re-emits SIGNED_IN) doesn't re-render every consumer.
    // USER_UPDATED keeps the same token but carries new metadata, so always apply it.
    const applySession = (next: Session | null, force = false) => {
      setSession((prev) => (!force && isSameSession(prev, next) ? prev : next));
      setUser((prev) => (!force && prev?.id === next?.user?.id ? prev : next?.user ?? null));
    };

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) =>
      applySession(session, event === "USER_UPDATED")
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <AuthContext.Provider value={{ user, session, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
