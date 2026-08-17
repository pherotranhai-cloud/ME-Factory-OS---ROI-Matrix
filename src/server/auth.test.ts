import { describe, it, expect, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  bearerToken,
  canEditReport,
  isAdmin,
  requireCaller,
  optionalCaller,
  clearIdentityCache,
  AuthError,
  type Caller,
} from './auth';

/**
 * A stand-in for the Supabase client covering only the calls `auth.ts` makes.
 *
 * Worth the small amount of scaffolding: the interesting logic is *which* users
 * row a verified identity resolves to, and that branch cannot be exercised
 * against a live project without creating real accounts.
 */
interface Row { id: number; email: string; role: string | null; auth_user_id: string | null }

const stub = (opts: {
  authUser?: { id: string; email?: string } | null;
  authError?: boolean;
  rows?: Row[];
}) => {
  const rows: Row[] = opts.rows ? [...opts.rows] : [];
  let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1;
  const inserts: Array<Record<string, unknown>> = [];

  const client = {
    auth: {
      getUser: async () =>
        opts.authError || !opts.authUser
          ? { data: { user: null }, error: { message: 'bad jwt' } }
          : { data: { user: opts.authUser }, error: null },
    },
    from: (table: string) => {
      if (table !== 'users') throw new Error(`unexpected table ${table}`);
      let filter: { column: string; value: unknown } | null = null;
      let pending: Record<string, unknown> | null = null;
      let mode: 'select' | 'update' | 'insert' = 'select';

      const match = () =>
        rows.find((r) => filter && (r as unknown as Record<string, unknown>)[filter.column] === filter.value);

      const builder = {
        select() { return builder; },
        eq(column: string, value: unknown) { filter = { column, value }; return builder; },
        update(patch: Record<string, unknown>) { mode = 'update'; pending = patch; return builder; },
        insert(row: Record<string, unknown>) { mode = 'insert'; pending = row; inserts.push(row); return builder; },
        async maybeSingle() { return { data: match() ?? null, error: null }; },
        async single() {
          if (mode === 'update') {
            const row = match();
            if (!row) return { data: null, error: { message: 'not found' } };
            Object.assign(row, pending);
            return { data: row, error: null };
          }
          if (mode === 'insert') {
            // `role` is intentionally absent from the insert; the column default
            // supplies it. The stub models that default explicitly.
            const row: Row = {
              id: nextId++,
              email: String(pending?.email ?? ''),
              role: (pending?.role as string) ?? 'user',
              auth_user_id: (pending?.auth_user_id as string) ?? null,
            };
            rows.push(row);
            return { data: row, error: null };
          }
          return { data: match() ?? null, error: null };
        },
      };
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, rows, inserts };
};

const AUTH_ID = '11111111-2222-3333-4444-555555555555';
const HEADER = 'Bearer some.jwt.value';

beforeEach(() => clearIdentityCache());

describe('reading the bearer header', () => {
  it.each([
    ['Bearer abc', 'abc'],
    ['bearer abc', 'abc'],
    ['  Bearer   abc  ', 'abc'],
  ])('accepts %s', (header, expected) => expect(bearerToken(header)).toBe(expected));

  it.each([[undefined], [null], [''], ['abc'], ['Basic abc'], ['Bearer'], ['Bearer   '], [42]])(
    'rejects %s',
    (header) => expect(bearerToken(header)).toBeNull(),
  );
});

describe('who may edit a report', () => {
  const user: Caller = { id: 7, authUserId: AUTH_ID, email: 'a@b.c', role: 'user' };
  const admin: Caller = { ...user, id: 8, role: 'admin' };

  it('lets a user edit their own', () => expect(canEditReport(user, 7)).toBe(true));
  it('stops a user editing someone else\'s', () => expect(canEditReport(user, 9)).toBe(false));
  it('lets an admin edit anything, including unowned', () => {
    expect(canEditReport(admin, 9)).toBe(true);
    expect(canEditReport(admin, null)).toBe(true);
  });

  /**
   * An unowned report must not become editable by everyone. Rows predating
   * authentication can have a null owner, and `null == null` would have made
   * them world-writable.
   */
  it('does not let a user edit an unowned report', () => {
    expect(canEditReport(user, null)).toBe(false);
    expect(canEditReport(user, undefined)).toBe(false);
  });

  it('reports admin status', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(user)).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe('resolving a caller', () => {
  it('refuses when the server has no Supabase client', async () => {
    await expect(requireCaller(null, HEADER)).rejects.toMatchObject({ status: 503 });
  });

  it('refuses a missing header with 401, not 500', async () => {
    const { client } = stub({ authUser: { id: AUTH_ID, email: 'a@b.c' } });
    await expect(requireCaller(client, undefined)).rejects.toMatchObject({ status: 401 });
  });

  it('refuses an invalid token with 401', async () => {
    const { client } = stub({ authError: true });
    const err = await requireCaller(client, HEADER).catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.status).toBe(401);
  });

  it('finds an already linked user and reports their role', async () => {
    const { client } = stub({
      authUser: { id: AUTH_ID, email: 'boss@laiyih.com' },
      rows: [{ id: 3, email: 'boss@laiyih.com', role: 'admin', auth_user_id: AUTH_ID }],
    });
    await expect(requireCaller(client, HEADER)).resolves.toMatchObject({ id: 3, role: 'admin' });
  });

  /**
   * The case that would otherwise break: `users.email` is unique and the table
   * predates authentication, so signing in with an address that already has a
   * row must adopt it. Inserting would violate the constraint, and a second row
   * would orphan every report the first one owns.
   */
  it('adopts an existing row that matches on email rather than inserting', async () => {
    const { client, rows, inserts } = stub({
      authUser: { id: AUTH_ID, email: 'operator@laiyih.com' },
      rows: [{ id: 1, email: 'operator@laiyih.com', role: 'user', auth_user_id: null }],
    });

    const caller = await requireCaller(client, HEADER);

    expect(caller.id).toBe(1);
    expect(inserts).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].auth_user_id).toBe(AUTH_ID);
  });

  it('creates a row for a genuinely new signup', async () => {
    const { client, inserts } = stub({ authUser: { id: AUTH_ID, email: 'new@laiyih.com' }, rows: [] });
    const caller = await requireCaller(client, HEADER);
    expect(caller.email).toBe('new@laiyih.com');
    expect(inserts).toHaveLength(1);
  });

  /** Privileges must come from the database, never from anything the caller sends. */
  it('never lets a signup nominate its own role', async () => {
    const { client, inserts } = stub({ authUser: { id: AUTH_ID, email: 'new@laiyih.com' }, rows: [] });
    const caller = await requireCaller(client, HEADER);
    expect(caller.role).toBe('user');
    expect(inserts[0]).not.toHaveProperty('role');
  });

  it('treats any unrecognised role value as the least privileged', async () => {
    const { client } = stub({
      authUser: { id: AUTH_ID, email: 'x@y.z' },
      rows: [{ id: 4, email: 'x@y.z', role: 'Operator', auth_user_id: AUTH_ID }],
    });
    await expect(requireCaller(client, HEADER)).resolves.toMatchObject({ role: 'user' });
  });

  it('refuses an identity with no email address', async () => {
    const { client } = stub({ authUser: { id: AUTH_ID } });
    await expect(requireCaller(client, HEADER)).rejects.toMatchObject({ status: 403 });
  });
});

describe('optional callers', () => {
  it('is null with no header, so the public response still renders', async () => {
    const { client } = stub({ authUser: { id: AUTH_ID, email: 'a@b.c' } });
    await expect(optionalCaller(client, undefined)).resolves.toBeNull();
  });

  it('is null for a bad token rather than an error', async () => {
    const { client } = stub({ authError: true });
    await expect(optionalCaller(client, HEADER)).resolves.toBeNull();
  });

  it('resolves a good token', async () => {
    const { client } = stub({
      authUser: { id: AUTH_ID, email: 'a@b.c' },
      rows: [{ id: 5, email: 'a@b.c', role: 'user', auth_user_id: AUTH_ID }],
    });
    await expect(optionalCaller(client, HEADER)).resolves.toMatchObject({ id: 5 });
  });
});
