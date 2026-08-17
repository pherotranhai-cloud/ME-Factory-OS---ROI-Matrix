import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Authentication and authorization for the API.
 *
 * The browser holds a Supabase Auth session and sends its access token as a
 * bearer header. This module verifies that token, resolves the caller to a row
 * in `public.users`, and reports their role. Every database read and write still
 * goes through the service-role client, which bypasses RLS — so **this module is
 * the access control**, not the RLS policies. RLS is left enabled with no table
 * policies so that the anon key published in the browser bundle cannot reach the
 * tables at all; it is a backstop, not the mechanism.
 *
 * Roles are deliberately just two. They are assigned by editing `public.users`
 * directly, so the role is re-read on every request rather than cached with the
 * token: a change made in the Supabase dashboard takes effect on the next call
 * instead of whenever a session happens to expire.
 */

export type Role = 'admin' | 'user';

export interface Caller {
  /** `public.users.id` — what `roi_reports.user_id` points at. */
  id: number;
  /** `auth.users.id`. */
  authUserId: string;
  email: string;
  role: Role;
}

/**
 * Fields declared explicitly rather than as constructor parameter properties.
 * Production runs `ts-node server.ts` under Node's type-stripping, which rejects
 * any TypeScript that has to emit code — parameter properties included. That
 * took the backend down once.
 */
export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/** Pull the token out of an `Authorization: Bearer <token>` header. */
export const bearerToken = (header: unknown): string | null => {
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
};

/**
 * Token verification is a network call to Supabase, so identities are cached
 * briefly. Only the *identity* is cached — never the role, which is read fresh
 * on every request.
 */
interface CachedIdentity {
  authUserId: string;
  email: string;
  expiresAt: number;
}

const IDENTITY_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 500;
const identityCache = new Map<string, CachedIdentity>();

/** Exposed for tests; also lets a deployment drop the cache if it ever needs to. */
export const clearIdentityCache = (): void => identityCache.clear();

const verifyToken = async (
  supabase: SupabaseClient,
  token: string,
): Promise<{ authUserId: string; email: string }> => {
  const now = Date.now();
  const hit = identityCache.get(token);
  if (hit && hit.expiresAt > now) {
    return { authUserId: hit.authUserId, email: hit.email };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new AuthError('Your session is not valid. Please sign in again.', 401);
  }
  const email = data.user.email;
  if (!email) {
    throw new AuthError('This account has no email address associated with it.', 403);
  }

  // Cheapest possible eviction: the cache is a latency optimisation, so dropping
  // all of it costs one extra verification per active session.
  if (identityCache.size >= MAX_CACHE_ENTRIES) identityCache.clear();
  identityCache.set(token, { authUserId: data.user.id, email, expiresAt: now + IDENTITY_TTL_MS });

  return { authUserId: data.user.id, email };
};

const asRole = (value: unknown): Role => (value === 'admin' ? 'admin' : 'user');

/**
 * Find or create the `public.users` row for a verified identity.
 *
 * Three cases, in order. The middle one matters: `users.email` is unique and the
 * table predates authentication, so a person signing up with an address that
 * already has a row (the seeded `operator@laiyih.com`, say) must *adopt* that
 * row — inserting would violate the constraint, and creating a second row would
 * orphan the reports the first one owns.
 */
const resolveAppUser = async (
  supabase: SupabaseClient,
  authUserId: string,
  email: string,
): Promise<Caller> => {
  const byAuthId = await supabase
    .from('users')
    .select('id, email, role')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (byAuthId.data) {
    return {
      id: byAuthId.data.id,
      authUserId,
      email: byAuthId.data.email ?? email,
      role: asRole(byAuthId.data.role),
    };
  }

  const byEmail = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', email)
    .maybeSingle();
  if (byEmail.data) {
    const linked = await supabase
      .from('users')
      .update({ auth_user_id: authUserId })
      .eq('id', byEmail.data.id)
      .select('id, email, role')
      .single();
    if (linked.error) throw new AuthError('Could not link your account.', 500);
    return {
      id: linked.data.id,
      authUserId,
      email: linked.data.email ?? email,
      role: asRole(linked.data.role),
    };
  }

  // New signup. `role` is left to the column default so a caller can never
  // nominate their own privileges, whatever the request body says.
  const created = await supabase
    .from('users')
    .insert({ auth_user_id: authUserId, email, name: email.split('@')[0] })
    .select('id, email, role')
    .single();
  if (created.error) throw new AuthError('Could not create your account record.', 500);

  return {
    id: created.data.id,
    authUserId,
    email: created.data.email ?? email,
    role: asRole(created.data.role),
  };
};

/**
 * Verify a bearer header and resolve the caller. Throws `AuthError` when the
 * token is absent or invalid.
 */
export const requireCaller = async (
  supabase: SupabaseClient | null,
  authorization: unknown,
): Promise<Caller> => {
  if (!supabase) throw new AuthError('The server is not configured for sign-in.', 503);

  const token = bearerToken(authorization);
  if (!token) throw new AuthError('Please sign in to continue.', 401);

  const identity = await verifyToken(supabase, token);
  return resolveAppUser(supabase, identity.authUserId, identity.email);
};

/**
 * Resolve the caller if a usable token is present, otherwise `null`.
 *
 * Used by endpoints that answer everyone but answer signed-in callers more
 * fully. A malformed or expired token yields `null` rather than an error: the
 * public form of the response is still correct for that caller.
 */
export const optionalCaller = async (
  supabase: SupabaseClient | null,
  authorization: unknown,
): Promise<Caller | null> => {
  if (!supabase || !bearerToken(authorization)) return null;
  try {
    return await requireCaller(supabase, authorization);
  } catch {
    return null;
  }
};

/** Admins may act on anything; a user may act only on what they own. */
export const canEditReport = (caller: Caller, ownerId: number | null | undefined): boolean =>
  caller.role === 'admin' || (ownerId != null && ownerId === caller.id);

export const isAdmin = (caller: Caller | null): boolean => caller?.role === 'admin';
