import React from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { API_BASE_URL } from '../config/api';

/**
 * Session and role for the browser.
 *
 * The role is *not* read from the JWT. Roles are assigned by editing
 * `public.users` in Supabase, and a token issued before that edit would still
 * carry the old claim — so the role comes from the API, which reads the table on
 * every request. What the browser knows is therefore only ever used to decide
 * what to *show*; the server decides what is allowed. Hiding a button is a
 * courtesy to the user, never a security boundary.
 */

export type Role = 'admin' | 'user';

interface AuthState {
  /** Undefined until the initial session check completes, so the UI can wait. */
  session: Session | null | undefined;
  email: string | null;
  role: Role | null;
  isSignedIn: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

/** Readable messages for the handful of Supabase auth errors users actually hit. */
const friendly = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email and password do not match an account.';
  if (m.includes('email not confirmed')) return 'Please confirm your email address first, then sign in.';
  if (m.includes('already registered')) return 'An account with that email already exists. Try signing in.';
  if (m.includes('password should be')) return 'Please choose a password of at least 6 characters.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a minute and try again.';
  return message;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = React.useState<Session | null | undefined>(undefined);
  const [role, setRole] = React.useState<Role | null>(null);

  React.useEffect(() => {
    // `supabase` degrades to a stub when the environment variables are missing,
    // so the app still renders rather than crashing on a blank screen.
    if (typeof supabase?.auth?.getSession !== 'function') {
      setSession(null);
      return;
    }

    let alive = true;
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (alive) setSession(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event: string, next: Session | null) => {
      setSession(next);
    });

    return () => { alive = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  // The role is whatever the API says it is, re-asked whenever the session
  // changes. `whoami` is cheap and means a promotion made in the Supabase
  // dashboard shows up on the next sign-in rather than never.
  React.useEffect(() => {
    if (!session) { setRole(null); return; }
    let alive = true;
    fetch(`${API_BASE_URL}/whoami`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (alive) setRole(body?.role === 'admin' ? 'admin' : 'user'); })
      .catch(() => { if (alive) setRole('user'); });
    return () => { alive = false; };
  }, [session]);

  /**
   * `src/lib/supabase.ts` falls back to a stub with only `storage` when the
   * environment variables are missing, so that a misconfigured deployment
   * renders instead of showing a blank page. That stub has no `auth`, and
   * reaching into it would throw an unreadable TypeError on the first click —
   * so the misconfiguration is reported as a sentence instead.
   */
  const assertAuthAvailable = () => {
    if (typeof supabase?.auth?.signInWithPassword !== 'function') {
      throw new Error(
        'Sign-in is not configured on this deployment. VITE_SUPABASE_URL and '
        + 'VITE_SUPABASE_ANON_KEY need to be set at build time.',
      );
    }
  };

  const signIn = React.useCallback(async (email: string, password: string) => {
    assertAuthAvailable();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(friendly(error.message));
  }, []);

  const signUp = React.useCallback(async (email: string, password: string) => {
    assertAuthAvailable();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(friendly(error.message));
    // With email confirmation switched on, Supabase returns a user but no
    // session. Saying so beats a form that looks like it silently failed.
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = React.useCallback(async () => {
    if (typeof supabase?.auth?.signOut === 'function') await supabase.auth.signOut();
    setRole(null);
  }, []);

  const value: AuthState = React.useMemo(() => ({
    session,
    email: session?.user?.email ?? null,
    role,
    isSignedIn: !!session,
    isAdmin: role === 'admin',
    signIn,
    signUp,
    signOut,
  }), [session, role, signIn, signUp, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthState => {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
};

/**
 * `fetch` with the access token attached.
 *
 * Reads the token from the live Supabase session rather than taking it as an
 * argument, so a call made after a token refresh uses the new one. A 401 is
 * surfaced as a readable error instead of leaving the caller to parse it.
 */
export const apiFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  let token: string | undefined;
  if (typeof supabase?.auth?.getSession === 'function') {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  }

  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
};

/** As `apiFetch`, but parses JSON and turns a non-2xx into a thrown error. */
export const apiJson = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
  const res = await apiFetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || `The server returned ${res.status}.`);
  }
  return body as T;
};
