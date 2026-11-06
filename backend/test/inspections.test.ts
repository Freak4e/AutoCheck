import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { profileStore } from '../src/profiles.js';
import type { Pool } from '../src/db.js';

const db = new PGlite();
const ids = { customer: '10000000-0000-4000-8000-000000000001', inspector: '10000000-0000-4000-8000-000000000002', other: '10000000-0000-4000-8000-000000000003', admin: '10000000-0000-4000-8000-000000000004' };
let tail = Promise.resolve();
const pool: Pool = { query: (sql, values) => db.query(sql, values), async connect() {
  const previous = tail; let release!: () => void; tail = new Promise<void>(resolve => { release = resolve; }); await previous;
  return { query: (sql, values) => db.query(sql, values), release };
} };
const app = createApp({ pool, profiles: profileStore(pool), verifyToken: async token => token in ids ? { id: ids[token as keyof typeof ids] } : null });
const auth = (token = 'inspector') => ({ Authorization: `Bearer ${token}` });
let appointment: string;
before(async () => {
  await db.exec('CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY); CREATE ROLE anon; CREATE ROLE authenticated;');
  for (const file of ['schema.sql', 'changes/01-vehicles-slots-appointments.sql', 'changes/02-inspections-checklist.sql']) await db.exec(await readFile(new URL('../../database/' + file, import.meta.url), 'utf8'));
});
after(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec('TRUNCATE inspection_items, inspections, appointments, appointment_slots, vehicles, profiles, auth.users; UPDATE checklist_template_items SET is_active = true;');
  for (const [name, id] of Object.entries(ids)) {
    await db.query('INSERT INTO auth.users VALUES ($1)', [id]);
    await db.query('INSERT INTO profiles (id, name, role) VALUES ($1, $2, $3)', [id, name, name === 'other' ? 'INSPECTOR' : name.toUpperCase()]);
  }
  appointment = await book(-120, '1');
});
async function book(minutes: number, suffix: string) {
  const vehicle = (await db.query<{ id: string }>(`INSERT INTO vehicles (owner_id, registration_number, manufacturer, model, year, vin) VALUES ($1, $2, 'Renault', 'Clio', 2020, $3) RETURNING id`, [ids.customer, 'MB' + suffix, 'VF1AAAAA12345678' + suffix])).rows[0];
  const slot = (await db.query<{ id: string }>(`INSERT INTO appointment_slots (starts_at, ends_at) VALUES (now() + $1 * interval '1 minute', now() + ($1 + 30) * interval '1 minute') RETURNING id`, [minutes])).rows[0];
  return (await db.query<{ id: string }>('INSERT INTO appointments (slot_id, vehicle_id, customer_id) VALUES ($1, $2, $3) RETURNING id', [slot.id, vehicle.id, ids.customer])).rows[0].id;
}
async function start() { return (await request(app).post(`/api/appointments/${appointment}/start`).set(auth()).send({ inspectorId: ids.other }).expect(201)).body.id as string; }
async function detail(id: string) { return (await request(app).get(`/api/inspections/${id}`).set(auth()).expect(200)).body; }
async function complete(id: string) {
  await db.query("UPDATE inspections SET completed_at = clock_timestamp(), final_result = 'PASSED' WHERE id = $1", [id]);
  await db.query("UPDATE appointments SET status = 'COMPLETED' WHERE id = $1", [appointment]);
}

test('US-08 schedule includes booked vehicle data and server-computed eligibility, without findings', async () => {
  const future = await book(120, '2');
  const result = await request(app).get('/api/appointments').set(auth()).expect(200);
  assert.equal(result.body.length, 2); assert.equal(result.body[0].canStart, true);
  assert.equal(result.body.find((row: { id: string }) => row.id === future).canStart, false);
  assert.equal(result.body[0].vin.length, 17); assert.equal(result.body[0].notes, undefined);
  await request(app).get(`/api/appointments/${appointment}`).set(auth()).expect(200);
  await request(app).get('/api/vehicles').set(auth()).expect(403);
});
test('US-08/09 role checks protect list, details, takeover and inspection endpoints', async () => {
  for (const role of ['customer', 'admin']) {
    await request(app).get('/api/appointments').set(auth(role)).expect(403);
    await request(app).post(`/api/appointments/${appointment}/start`).set(auth(role)).expect(403);
  }
  await request(app).get('/api/appointments').expect(401);
  await request(app).get('/api/appointments/10000000-0000-4000-8000-000000000099').set(auth()).expect(404);
});
test('US-09 starts late booking atomically, copies seven items and ignores forged inspector', async () => {
  const id = await start(); const data = await detail(id);
  assert.equal(data.status, 'IN_PROGRESS'); assert.equal(data.items.length, 7);
  assert.equal(data.finalResult, null); assert.equal(data.completedAt, null);
  assert.ok(data.items.every((item: { result: string }) => item.result === 'NOT_CHECKED'));
  assert.equal((await db.query('SELECT inspector_id FROM inspections WHERE id = $1', [id])).rows[0].inspector_id, ids.inspector);
  assert.ok(Date.parse(data.startedAt) > Date.parse(data.endsAt));
});
test('US-09 rejects future or repeated takeover without duplicate inspection/items', async () => {
  const future = await book(60, '2');
  await request(app).post(`/api/appointments/${future}/start`).set(auth()).expect(409);
  await start();
  await request(app).post(`/api/appointments/${appointment}/start`).set(auth()).expect(409);
  assert.equal((await db.query('SELECT * FROM inspections')).rows.length, 1);
  assert.equal((await db.query('SELECT * FROM inspection_items')).rows.length, 7);
});
test('US-08/09 active overtime blocks another claim and remains resumable only by its owner', async () => {
  const second = await book(-60, '2'); const id = await start();
  await request(app).post(`/api/appointments/${second}/start`).set(auth('other')).expect(409);
  const schedule = (await request(app).get('/api/appointments').set(auth('other')).expect(200)).body;
  assert.equal(schedule[0].overdue, true); assert.equal(schedule[0].isMine, false); assert.equal(schedule[1].canStart, false);
  await request(app).get(`/api/inspections/${id}`).set(auth('other')).expect(404);
  await detail(id);
});
test('US-09 empty template rolls back status, inspection and all copied rows', async () => {
  await db.exec('UPDATE checklist_template_items SET is_active = false');
  await request(app).post(`/api/appointments/${appointment}/start`).set(auth()).expect(409);
  assert.equal((await db.query('SELECT status FROM appointments WHERE id = $1', [appointment])).rows[0].status, 'BOOKED');
  assert.equal((await db.query('SELECT * FROM inspections')).rows.length, 0);
});
test('US-10 persists scores/notes, allows resetting and freezes copied template text', async () => {
  const id = await start(); const data = await detail(id); const item = data.items[0];
  for (const result of ['PASS', 'FAIL', 'NOT_CHECKED']) {
    await request(app).patch(`/api/inspections/${id}/items/${item.id}`).set(auth()).send({ result, notes: ' Opomba ', name: 'Forged' }).expect(200);
    assert.equal((await detail(id)).items[0].result, result);
  }
  await db.exec("UPDATE checklist_template_items SET name = 'Updated template' WHERE sort_order = 1");
  assert.equal((await detail(id)).items[0].name, item.name);
  await request(app).patch(`/api/inspections/${id}`).set(auth()).send({ notes: ' Splošna opomba ', finalResult: 'PASSED' }).expect(200);
  assert.equal((await detail(id)).notes, 'Splošna opomba'); assert.equal((await detail(id)).finalResult, null);
});
test('US-10 rejects invalid scores/notes and foreign item without changing saved data', async () => {
  const id = await start(); const item = (await detail(id)).items[0];
  for (const body of [{ result: 'BAD' }, { result: 'PASS', notes: 3 }, { result: 'PASS', notes: 'x'.repeat(2001) }]) {
    await request(app).patch(`/api/inspections/${id}/items/${item.id}`).set(auth()).send(body).expect(400);
  }
  await request(app).patch(`/api/inspections/${id}/items/10000000-0000-4000-8000-000000000099`).set(auth()).send({ result: 'PASS' }).expect(404);
  await request(app).patch(`/api/inspections/${id}/items/${item.id}`).set(auth('other')).send({ result: 'PASS' }).expect(404);
  await request(app).patch(`/api/inspections/${id}`).set(auth('customer')).send({ notes: 'bad' }).expect(403);
  assert.equal((await detail(id)).items[0].result, 'NOT_CHECKED');
});
test('US-08/10 completed own inspection is read-only; station becomes available again', async () => {
  const second = await book(-60, '2'); const id = await start(); const item = (await detail(id)).items[0]; await complete(id);
  assert.equal((await detail(id)).status, 'COMPLETED');
  await request(app).patch(`/api/inspections/${id}`).set(auth()).send({ notes: 'no' }).expect(409);
  await request(app).patch(`/api/inspections/${id}/items/${item.id}`).set(auth()).send({ result: 'PASS' }).expect(409);
  await request(app).post(`/api/appointments/${second}/start`).set(auth('other')).expect(201);
});
test('US-10 item belonging to another inspection returns 404', async () => {
  const second = await book(-60, '2'); const firstId = await start(); const firstItem = (await detail(firstId)).items[0]; await complete(firstId);
  const nextId = (await request(app).post(`/api/appointments/${second}/start`).set(auth()).expect(201)).body.id;
  await request(app).patch(`/api/inspections/${nextId}/items/${firstItem.id}`).set(auth()).send({ result: 'PASS' }).expect(404);
});
test('new tables block direct Supabase client access', async () => {
  await db.exec('GRANT USAGE ON SCHEMA public TO anon, authenticated');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    try { for (const table of ['inspections', 'inspection_items', 'checklist_template_items']) await assert.rejects(db.query(`SELECT * FROM ${table}`)); }
    finally { await db.exec('RESET ROLE'); }
  }
});
