import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

type AuthResult = { error: string | null };

type AuthContextValue = {
  /** Current session, or null when signed out. */
  session: Session | null;
  /** True until the initial session check resolves. */
  initializing: boolean;
  signUp: (input: { name: string; email: string; password: string }) => Promise<AuthResult>;
  signIn: (input: { email: string; password: string }) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const NOT_CONFIGURED =
  'Supabase isn’t configured yet. Add your keys to .env — see the README.';

/** Turn Supabase / network errors into calm, user-facing copy (never raw). */
function toMessage(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (m.includes('email not confirmed')) return 'Please confirm your email, then log in.';
  if (m.includes('already registered') || m.includes('already exists')) {
    return 'An account with this email already exists.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'Network error. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
      })
      .catch(() => {
        // Treat any failure as "no session" — the gate routes to auth landing.
      })
      .finally(() => {
        if (active) setInitializing(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      initializing,
      signUp: async ({ name, email, password }) => {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        return { error: error ? toMessage(error.message) : null };
      },
      signIn: async ({ email, password }) => {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error ? toMessage(error.message) : null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
