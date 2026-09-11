import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "worker" | "customer";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: Role | null;
  fullName: string;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);

  const loadRole = async (uid: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .limit(1)
      .maybeSingle();
    setRole((data?.role as Role) ?? "customer");
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", uid)
      .maybeSingle();
    setFullName(profile?.full_name ?? "");
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setTimeout(() => {
          void loadRole(newSession.user.id);
        }, 0);
      } else {
        setRole(null);
        setFullName("");
      }
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await loadRole(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    if (user) await loadRole(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, fullName, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const homeForRole = (role: Role | null) =>
  role === "admin" ? "/admin" : role === "worker" ? "/worker" : "/customer";
