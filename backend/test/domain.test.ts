import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { profileStore } from '../src/profiles.js';
import type { Pool } from '../src/db.js';

const ids = { customer: '10000000-0000-4000-8000-000000000001', other: '10000000-0000-4000-8000-000000000002', admin: '10000000-0000-4000-8000-000000000003', inspector: '10000000-0000-4000-8000-000000000004' };
const db = new PGlite();
let tail = Promise.resolve();
const pool: Pool = {
  query: (sql, values) => db.query(sql, values),
  async connect() {
    const previous = tail;
    let unlock!: () => void;
    tail = new Promise<void>(resolve => { unlock = resolve; });
    await previous;
    return { query: (sql, values) => db.query(sql, values), release: unlock };
  },
};
const app = createApp({ pool, profiles: profileStore(pool), verifyToken: async token => token in ids ? { id: ids[token as keyof typeof ids] } : null });
const as = (token: string) => ({ Authorization: `Bearer ${token}` });
const car = { registrationNumber: ' mb-ab 123 ', manufacturer: 'Renault', model: 'Clio', year: 2020, vin: 'vf1aaaaa123456789' };
const future = (minutes = 0) => new Date(Date.now() + 7 * 24 * 3600000 + minutes * 60000).toISOString();
const createCar = async (owner = 'customer', suffix = '1') => (await request(app).post('/api/vehicles').set(as(owner)).send({ ...car, registrationNumber: 'MB'+suffix, vin: 'VF1AAAAA12345678'+suffix }).expect(201)).body;
const createSlot = async (startsAt = future()) => (await request(app).post('/api/slots').set(as('admin')).send({ startsAt }).expect(201)).body;

before(async () => {
  await db.exec('CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY); CREATE ROLE anon; CREATE ROLE authenticated;');
  await db.exec(await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../database/changes/01-vehicles-slots-appointments.sql', import.meta.url), 'utf8'));
});
after(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec('TRUNCATE appointments, appointment_slots, vehicles, profiles, auth.users;');
  for (const [role, id] of Object.entries(ids)) {
    await db.query('INSERT INTO auth.users VALUES ($1)', [id]);
    await db.query('INSERT INTO profiles (id, name, role) VALUES ($1, $2, $3)', [id, role, role === 'other' ? 'CUSTOMER' : role.toUpperCase()]);
  }
});

test('US-03: normalizes registration/VIN and takes owner from the verified account', async () => {
  const result = await request(app).post('/api/vehicles').set(as('customer')).send({ ...car, ownerId: ids.other }).expect(201);
  assert.equal(result.body.registrationNumber, 'MBAB123'); assert.equal(result.body.vin, car.vin.toUpperCase()); assert.equal(result.body.ownerId, ids.customer);
  const own = await request(app).get('/api/vehicles').set(as('customer')).expect(200);
  const other = await request(app).get('/api/vehicles').set(as('other')).expect(200);
  assert.equal(own.body.length, 1); assert.equal(other.body.length, 0);
});

test('US-03: validates every required value, VIN and year before storing', async () => {
  for (const invalid of [{ registrationNumber: ' - ' }, { manufacturer: ' ' }, { model: '' }, { year: 1899 }, { year: 2020.5 }, { year: '2020' }, { year: 9999 }, { vin: 'I'.repeat(17) }, { vin: 'O'.repeat(17) }, { vin: 'Q'.repeat(17) }, { vin: '123' }]) {
    await request(app).post('/api/vehicles').set(as('customer')).send({ ...car, ...invalid }).expect(400);
  }
  assert.equal((await db.query('SELECT * FROM vehicles')).rows.length, 0);
});

test('US-03: duplicate normalized plate or VIN returns conflict without disclosing owner', async () => {
  await request(app).post('/api/vehicles').set(as('customer')).send(car).expect(201);
  for (const duplicate of [{ ...car, registrationNumber: 'MBAB123', vin: 'VF1AAAAA123456788' }, { ...car, registrationNumber: 'LJNEW' }]) {
    const response = await request(app).post('/api/vehicles').set(as('other')).send(duplicate).expect(409);
    assert.ok(!JSON.stringify(response.body).includes(ids.customer));
  }
});

test('US-04: edits own unbooked vehicle, preserves owner and rejects invalid update atomically', async () => {
  const vehicle = await createCar();
  await request(app).patch(`/api/vehicles/${vehicle.id}`).set(as('customer')).send({ ...car, model: 'Megane', ownerId: ids.other }).expect(200);
  await request(app).patch(`/api/vehicles/${vehicle.id}`).set(as('customer')).send({ ...car, model: 'Bad', year: 0 }).expect(400);
  const saved = await request(app).get(`/api/vehicles/${vehicle.id}`).set(as('customer')).expect(200);
  assert.equal(saved.body.model, 'Megane'); assert.equal(saved.body.ownerId, ids.customer);
});

test('US-04/F02: foreign vehicles return 404; admin can read but not edit, inspector cannot list', async () => {
  const vehicle = await createCar();
  await request(app).get(`/api/vehicles/${vehicle.id}`).set(as('other')).expect(404);
  await request(app).patch(`/api/vehicles/${vehicle.id}`).set(as('other')).send(car).expect(404);
  await request(app).get('/api/vehicles').set(as('admin')).expect(200);
  await request(app).get(`/api/vehicles/${vehicle.id}`).set(as('admin')).expect(200);
  await request(app).patch(`/api/vehicles/${vehicle.id}`).set(as('admin')).send(car).expect(403);
  await request(app).get('/api/vehicles').set(as('inspector')).expect(403);
  await request(app).delete(`/api/vehicles/${vehicle.id}`).set(as('customer')).expect(404);
});

test('US-04: any appointment including COMPLETED permanently locks vehicle data', async () => {
  const vehicle = await createCar(); const slot = await createSlot();
  await request(app).post('/api/appointments').set(as('customer')).send({ vehicleId: vehicle.id, slotId: slot.id }).expect(201);
  for (const status of ['BOOKED', 'IN_PROGRESS', 'COMPLETED']) {
    await db.query('UPDATE appointments SET status = $1 WHERE vehicle_id = $2', [status, vehicle.id]);
    await request(app).patch(`/api/vehicles/${vehicle.id}`).set(as('customer')).send(car).expect(409);
    const saved = await request(app).get(`/api/vehicles/${vehicle.id}`).set(as('customer')).expect(200);
    assert.equal(saved.body.canEdit, false);
  }
});

test('US-05: only admin publishes future 30-minute slots; invalid dates and past are rejected', async () => {
  for (const token of ['customer', 'inspector']) await request(app).post('/api/slots').set(as(token)).send({ startsAt: future() }).expect(403);
  for (const startsAt of ['', 'wrong', '2030-02-30T10:00:00Z', '2030-01-01T24:00:00Z', '2030-01-01T10:00', '2000-01-01T10:00:00Z']) {
    await request(app).post('/api/slots').set(as('admin')).send({ startsAt }).expect(400);
  }
  const slot = await createSlot();
  assert.equal(new Date(slot.endsAt).valueOf() - new Date(slot.startsAt).valueOf(), 1800000);
});

test('US-05: overlap and same start conflict, touching interval is allowed', async () => {
  const start = future(); await createSlot(start);
  await request(app).post('/api/slots').set(as('admin')).send({ startsAt: start }).expect(409);
  await request(app).post('/api/slots').set(as('admin')).send({ startsAt: new Date(Date.parse(start) + 15 * 60000).toISOString() }).expect(409);
  await createSlot(new Date(Date.parse(start) + 30 * 60000).toISOString());
  assert.equal((await db.query('SELECT * FROM appointment_slots')).rows.length, 2);
});

test('US-06: booking persists BOOKED/current customer and removes slot from free list', async () => {
  const vehicle = await createCar(); const slot = await createSlot();
  const booking = await request(app).post('/api/appointments').set(as('customer')).send({ vehicleId: vehicle.id, slotId: slot.id, customerId: ids.other, status: 'COMPLETED' }).expect(201);
  assert.equal(booking.body.status, 'BOOKED'); assert.equal(booking.body.customerId, ids.customer);
  assert.equal(booking.body.registrationNumber, vehicle.registrationNumber);
  const free = await request(app).get('/api/slots').set(as('customer')).expect(200);
  assert.equal(free.body.length, 0);
  const all = await request(app).get('/api/slots').set(as('admin')).expect(200);
  assert.equal(all.body.length, 1); assert.equal(all.body[0].available, false);
});

test('US-06: malformed IDs, missing selection, foreign vehicle and staff booking are rejected', async () => {
  const vehicle = await createCar(); const slot = await createSlot();
  await request(app).post('/api/appointments').set(as('customer')).send({}).expect(400);
  await request(app).post('/api/appointments').set(as('customer')).send({ vehicleId: 'bad', slotId: slot.id }).expect(400);
  await request(app).post('/api/appointments').set(as('other')).send({ vehicleId: vehicle.id, slotId: slot.id }).expect(404);
  await request(app).post('/api/appointments').set(as('admin')).send({ vehicleId: vehicle.id, slotId: slot.id }).expect(403);
  assert.equal((await db.query('SELECT * FROM appointments')).rows.length, 0);
});

test('US-06: occupied slot/open vehicle rejects duplicate without partial records; COMPLETED allows new booking', async () => {
  const vehicle = await createCar(); const another = await createCar('other', '2');
  const start = future(); const slot = await createSlot(start); const next = await createSlot(new Date(Date.parse(start) + 30 * 60000).toISOString());
  await request(app).post('/api/appointments').set(as('customer')).send({ vehicleId: vehicle.id, slotId: slot.id }).expect(201);
  await request(app).post('/api/appointments').set(as('other')).send({ vehicleId: another.id, slotId: slot.id }).expect(409);
  await request(app).post('/api/appointments').set(as('customer')).send({ vehicleId: vehicle.id, slotId: next.id }).expect(409);
  assert.equal((await db.query('SELECT * FROM appointments')).rows.length, 1);
  await db.query("UPDATE appointments SET status = 'COMPLETED' WHERE vehicle_id = $1", [vehicle.id]);
  await request(app).post('/api/appointments').set(as('customer')).send({ vehicleId: vehicle.id, slotId: next.id }).expect(201);
});

test('US-06: slot that has become past is neither offered nor bookable', async () => {
  const vehicle = await createCar();
  const slot = (await db.query<{ id: string }>("INSERT INTO appointment_slots (starts_at, ends_at) VALUES (now() - interval '1 hour', now() - interval '30 minutes') RETURNING id")).rows[0];
  await request(app).post('/api/appointments').set(as('customer')).send({ vehicleId: vehicle.id, slotId: slot.id }).expect(409);
  const result = await request(app).get('/api/slots').set(as('customer')).expect(200);
  assert.equal(result.body.length, 0);
});

test('new tables deny direct access to public Supabase roles', async () => {
  await db.exec('GRANT USAGE ON SCHEMA public TO anon, authenticated;');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    try { for (const table of ['vehicles', 'appointment_slots', 'appointments']) await assert.rejects(db.query(`SELECT * FROM ${table}`)); }
    finally { await db.exec('RESET ROLE'); }
  }
});
