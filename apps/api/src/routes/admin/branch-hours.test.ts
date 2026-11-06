import { createDatabase, schema } from '@paw/db';
import {
  insertTestAreas,
  insertTestBranch,
  insertTestBusiness,
  insertTestUser,
  testDatabaseUrl,
} from '@paw/db/testing';
import { addDays, toManila } from '@paw/domain';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.ts';
import { sessionCookie, testEnv } from '../../testing.ts';

let app: Awaited<ReturnType<typeof buildApp>>;
let cookie: string;
const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

beforeAll(async () => {
  app = await buildApp({ env: testEnv() });
  await insertTestAreas(db);
  const admin = await insertTestUser(db, { platformRole: 'super_admin' });
  cookie = await sessionCookie(app, admin.id);
});

afterAll(async () => {
  await app.close();
  await database.close();
});

const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined && { payload }) });

const auditEntries = (entityId: string) =>
  db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, entityId));

const newBranch = async () => insertTestBranch(db, (await insertTestBusiness(db)).id);

const today = () => toManila(new Date()).date;

/** Mon–Fri 8–12 and 1–5 (lunch break), plus a Saturday night shift past midnight. */
const clinicWeek = [
  ...[1, 2, 3, 4, 5].flatMap((dayOfWeek) => [
    { dayOfWeek, opensAt: '13:00', closesAt: '17:00' },
    { dayOfWeek, opensAt: '08:00', closesAt: '12:00' },
  ]),
  { dayOfWeek: 6, opensAt: '20:00', closesAt: '02:00' },
];

interface HoursBody {
  today: string;
  is24h: boolean;
  weekly: { dayOfWeek: number; opensAt: string; closesAt: string }[];
  exceptions: { date: string; isClosed: boolean; intervals: unknown[]; note: string | null }[];
  hoursConfirmedAt: string | null;
  hoursConfirmedBy: string | null;
}

describe('GET /v1/admin/branches/:id/hours', () => {
  it('returns no hours for a new branch', async () => {
    const branch = await newBranch();
    const response = await call('GET', `/v1/admin/branches/${branch.id}/hours`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      branchId: branch.id,
      businessType: 'vet_clinic',
      today: today(),
      is24h: false,
      weekly: [],
      exceptions: [],
      hoursConfirmedAt: null,
      hoursConfirmedBy: null,
    });
  });

  it('lists exceptions from today on, leaving past ones out', async () => {
    const branch = await newBranch();
    await db.insert(schema.branchHoursException).values([
      { branchId: branch.id, date: addDays(today(), -3), isClosed: true },
      { branchId: branch.id, date: addDays(today(), 5), isClosed: true, note: 'Holiday' },
      { branchId: branch.id, date: today(), isClosed: true },
    ]);

    const body = (await call('GET', `/v1/admin/branches/${branch.id}/hours`)).json<HoursBody>();
    expect(body.exceptions.map((e) => e.date)).toEqual([today(), addDays(today(), 5)]);
  });

  it('404 for an unknown branch', async () => {
    const response = await call('GET', `/v1/admin/branches/${crypto.randomUUID()}/hours`);
    expect(response.statusCode).toBe(404);
  });
});

describe('PUT /v1/admin/branches/:id/hours', () => {
  it('replaces the weekly hours, sorted, and records from → to', async () => {
    const branch = await newBranch();
    const url = `/v1/admin/branches/${branch.id}/hours`;
    await call('PUT', url, {
      is24h: false,
      weekly: [{ dayOfWeek: 7, opensAt: '09:00', closesAt: '12:00' }],
    });

    const response = await call('PUT', url, { is24h: false, weekly: clinicWeek });
    expect(response.statusCode).toBe(200);
    const body = response.json<HoursBody>();
    expect(body.weekly).toHaveLength(11);
    expect(body.weekly.slice(0, 2)).toEqual([
      { dayOfWeek: 1, opensAt: '08:00', closesAt: '12:00' },
      { dayOfWeek: 1, opensAt: '13:00', closesAt: '17:00' },
    ]);
    expect(body.weekly.at(-1)).toEqual({ dayOfWeek: 6, opensAt: '20:00', closesAt: '02:00' });
    // Saving never confirms (D35).
    expect(body.hoursConfirmedAt).toBeNull();

    const updates = (await auditEntries(branch.id)).filter(
      (e) => e.action === 'branch.update_hours',
    );
    expect(updates).toHaveLength(2);
    const last = updates.find((e) => {
      const from = e.diff?.weeklyHours?.from;
      return Array.isArray(from) && from.length === 1;
    });
    expect(last?.diff).toEqual({
      weeklyHours: {
        from: [{ dayOfWeek: 7, opensAt: '09:00', closesAt: '12:00' }],
        to: body.weekly,
      },
    });
  });

  it('records nothing when the same hours are saved again, in any order', async () => {
    const branch = await newBranch();
    const url = `/v1/admin/branches/${branch.id}/hours`;
    await call('PUT', url, { is24h: false, weekly: clinicWeek });
    const response = await call('PUT', url, { is24h: false, weekly: [...clinicWeek].reverse() });

    expect(response.statusCode).toBe(200);
    const actions = (await auditEntries(branch.id)).map((e) => e.action);
    expect(actions).toEqual(['branch.update_hours']);
  });

  it('sets "open 24 hours" and clears all hours back to unknown', async () => {
    const branch = await newBranch();
    const url = `/v1/admin/branches/${branch.id}/hours`;
    await call('PUT', url, { is24h: false, weekly: clinicWeek });

    const allDay = await call('PUT', url, { is24h: true, weekly: [] });
    expect(allDay.json()).toMatchObject({ is24h: true, weekly: [] });
    const [row] = await db.select().from(schema.branch).where(eq(schema.branch.id, branch.id));
    expect(row?.is24h).toBe(true);
  });

  it('400 with a pointer at the interval that overlaps (including past midnight)', async () => {
    const branch = await newBranch();
    const response = await call('PUT', `/v1/admin/branches/${branch.id}/hours`, {
      is24h: false,
      weekly: [
        { dayOfWeek: 6, opensAt: '20:00', closesAt: '02:00' },
        { dayOfWeek: 7, opensAt: '01:00', closesAt: '09:00' },
      ],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errors: [{ pointer: '/weekly/1/opensAt' }] });
    expect(await auditEntries(branch.id)).toEqual([]);
  });

  it('400 for a malformed time or an empty interval', async () => {
    const branch = await newBranch();
    const url = `/v1/admin/branches/${branch.id}/hours`;
    const malformed = await call('PUT', url, {
      is24h: false,
      weekly: [{ dayOfWeek: 1, opensAt: '8am', closesAt: '12:00' }],
    });
    expect(malformed.json()).toMatchObject({ errors: [{ pointer: '/weekly/0/opensAt' }] });

    const empty = await call('PUT', url, {
      is24h: false,
      weekly: [{ dayOfWeek: 1, opensAt: '08:00', closesAt: '08:00' }],
    });
    expect(empty.json()).toMatchObject({ errors: [{ pointer: '/weekly/0/closesAt' }] });
  });
});

describe('PUT / DELETE /v1/admin/branches/:id/hours-exceptions/:date', () => {
  const url = (branchId: string, date: string) =>
    `/v1/admin/branches/${branchId}/hours-exceptions/${date}`;

  it('sets a closure, then special hours on the same date, recording each', async () => {
    const branch = await newBranch();
    const date = addDays(today(), 10);

    const closed = await call('PUT', url(branch.id, date), {
      isClosed: true,
      intervals: [],
      note: "  All Saints' Day ",
    });
    expect(closed.statusCode).toBe(200);
    expect(closed.json<HoursBody>().exceptions).toEqual([
      { date, isClosed: true, intervals: [], note: "All Saints' Day" },
    ]);

    const special = await call('PUT', url(branch.id, date), {
      isClosed: false,
      intervals: [{ opensAt: '09:00', closesAt: '12:00' }],
      note: '',
    });
    expect(special.json<HoursBody>().exceptions).toEqual([
      { date, isClosed: false, intervals: [{ opensAt: '09:00', closesAt: '12:00' }], note: null },
    ]);

    const entries = (await auditEntries(branch.id)).filter(
      (e) => e.action === 'branch.set_hours_exception',
    );
    expect(entries.map((e) => e.diff?.hoursException?.from ?? null)).toContainEqual(null);
    expect(entries.map((e) => e.diff?.hoursException?.to)).toContainEqual({
      date,
      isClosed: false,
      intervals: [{ opensAt: '09:00', closesAt: '12:00' }],
      note: null,
    });
  });

  it('marks a branch with unknown hours closed today', async () => {
    const branch = await newBranch();
    const response = await call('PUT', url(branch.id, today()), {
      isClosed: true,
      intervals: [],
      note: 'The vet is sick',
    });
    expect(response.json<HoursBody>()).toMatchObject({
      weekly: [],
      exceptions: [{ date: today(), isClosed: true, note: 'The vet is sick' }],
    });
  });

  it('removes an exception and records what it was', async () => {
    const branch = await newBranch();
    const date = addDays(today(), 1);
    await call('PUT', url(branch.id, date), { isClosed: true, intervals: [] });

    const response = await call('DELETE', url(branch.id, date));
    expect(response.statusCode).toBe(200);
    expect(response.json<HoursBody>().exceptions).toEqual([]);
    const removal = (await auditEntries(branch.id)).find(
      (e) => e.action === 'branch.delete_hours_exception',
    );
    expect(removal?.diff).toEqual({
      hoursException: { from: { date, isClosed: true, intervals: [], note: null }, to: null },
    });

    expect((await call('DELETE', url(branch.id, date))).statusCode).toBe(404);
  });

  it('400 for a date that has passed, or more than a year ahead', async () => {
    const branch = await newBranch();
    const body = { isClosed: true, intervals: [] };
    const past = await call('PUT', url(branch.id, addDays(today(), -1)), body);
    expect(past.statusCode).toBe(400);
    expect(past.json()).toMatchObject({ errors: [{ pointer: '/date' }] });

    const far = await call('PUT', url(branch.id, addDays(today(), 400)), body);
    expect(far.statusCode).toBe(400);
  });

  it('400 when closed and intervals disagree, or the intervals overlap', async () => {
    const branch = await newBranch();
    const date = addDays(today(), 2);
    const closedWithHours = await call('PUT', url(branch.id, date), {
      isClosed: true,
      intervals: [{ opensAt: '09:00', closesAt: '12:00' }],
    });
    expect(closedWithHours.json()).toMatchObject({ errors: [{ pointer: '/intervals' }] });

    const openWithout = await call('PUT', url(branch.id, date), { isClosed: false, intervals: [] });
    expect(openWithout.json()).toMatchObject({ errors: [{ pointer: '/intervals' }] });

    const overlapping = await call('PUT', url(branch.id, date), {
      isClosed: false,
      intervals: [
        { opensAt: '09:00', closesAt: '12:00' },
        { opensAt: '11:00', closesAt: '14:00' },
      ],
    });
    expect(overlapping.json()).toMatchObject({ errors: [{ pointer: '/intervals/1/opensAt' }] });
  });

  it('400 for a date that is not a date', async () => {
    const branch = await newBranch();
    const response = await call('PUT', url(branch.id, '2026-02-30'), {
      isClosed: true,
      intervals: [],
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('POST /v1/admin/branches/:id/hours/confirm', () => {
  it('records that PAW ops confirmed the hours', async () => {
    const branch = await newBranch();
    await call('PUT', `/v1/admin/branches/${branch.id}/hours`, {
      is24h: false,
      weekly: clinicWeek,
    });

    const before = Date.now();
    const response = await call('POST', `/v1/admin/branches/${branch.id}/hours/confirm`);
    expect(response.statusCode).toBe(200);
    const body = response.json<HoursBody>();
    expect(body.hoursConfirmedBy).toBe('paw_ops');
    expect(Date.parse(body.hoursConfirmedAt ?? '')).toBeGreaterThanOrEqual(before - 1000);

    const entry = (await auditEntries(branch.id)).find((e) => e.action === 'branch.confirm_hours');
    expect(entry?.diff).toMatchObject({
      hoursConfirmedAt: { from: null, to: body.hoursConfirmedAt },
      hoursConfirmedBy: { from: null, to: 'paw_ops' },
    });
  });

  it('400 when the branch has no hours to confirm', async () => {
    const branch = await newBranch();
    const response = await call('POST', `/v1/admin/branches/${branch.id}/hours/confirm`);
    expect(response.statusCode).toBe(400);
    expect(await auditEntries(branch.id)).toEqual([]);
  });
});
