// Explicitly run with npm run test:live. Never included in the normal/CI suite.
// Uses temporary UUID-scoped fixtures and removes only records created here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { readConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { profileStore } from '../src/profiles.js';

test('live PostgreSQL: concurrent slot publication, bookings and vehicle edits stay consistent', async () => {
  const config = readConfig();
  const pool = new pg.Pool({ connectionString: config.databaseUrl, ssl: config.ssl, connectionTimeoutMillis: 10000, max: 6 });
  const ids = { a: randomUUID(), b: randomUUID(), admin: randomUUID() };
  const slots: string[] = [];
  const app = createApp({ pool, profiles: profileStore(pool), verifyToken: async token => token in ids ? { id: ids[token as keyof typeof ids] } : null });
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const seed = randomUUID().replaceAll('-', '').toUpperCase();
  const vehicleData = (suffix: string) => ({ registrationNumber: `TEST${seed.slice(0, 10)}${suffix}`, manufacturer: 'Test', model: 'Temporary fixture', year: 2020, vin: seed.slice(0, 16) + suffix });
  const start = Date.UTC(2099, 0, 1) + Math.floor(Math.random() * 200000) * 3600000;
  async function slot(minutes: number) {
    const result = await request(app).post('/api/slots').set(auth('admin')).send({ startsAt: new Date(start + minutes * 60000).toISOString() }).expect(201);
    slots.push(result.body.id); return result.body;
  }
  async function vehicle(owner: string, suffix: string) {
    return (await request(app).post('/api/vehicles').set(auth(owner)).send(vehicleData(suffix)).expect(201)).body;
  }
  try {
    for (const [name, id] of Object.entries(ids)) {
      // FK-only Auth fixtures: no password, email, identity or usable login is created.
      await pool.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
      await pool.query('INSERT INTO public.profiles (id, name, role) VALUES ($1, $2, $3)', [id, 'AutoCheck test fixture', name === 'admin' ? 'ADMIN' : 'CUSTOMER']);
    }
    const slotRequests = await Promise.all([0, 15].map(minutes => request(app).post('/api/slots').set(auth('admin')).send({ startsAt: new Date(start + minutes * 60000).toISOString() })));
    for (const response of slotRequests) if (response.status === 201) slots.push(response.body.id);
    assert.deepEqual(slotRequests.map(r => r.status).sort(), [201, 409]);
    const sharedSlot = slotRequests.find(r => r.status === 201)!.body;
    const a = await vehicle('a', '1'); const b = await vehicle('b', '2');
    const sameSlot = await Promise.all([
      request(app).post('/api/appointments').set(auth('a')).send({ vehicleId: a.id, slotId: sharedSlot.id }),
      request(app).post('/api/appointments').set(auth('b')).send({ vehicleId: b.id, slotId: sharedSlot.id }),
    ]);
    assert.deepEqual(sameSlot.map(r => r.status).sort(), [201, 409]);
    const c = await vehicle('a', '3'); const second = await slot(120); const third = await slot(180);
    const sameVehicle = await Promise.all([second, third].map(s => request(app).post('/api/appointments').set(auth('a')).send({ vehicleId: c.id, slotId: s.id })));
    assert.deepEqual(sameVehicle.map(r => r.status).sort(), [201, 409]);

    const d = await vehicle('a', '4'); const fourth = await slot(240);
    const race = await Promise.all([
      request(app).post('/api/appointments').set(auth('a')).send({ vehicleId: d.id, slotId: fourth.id }),
      request(app).patch(`/api/vehicles/${d.id}`).set(auth('a')).send({ ...vehicleData('4'), model: 'Updated before booking' }),
    ]);
    assert.equal(race[0].status, 201); assert.ok([200, 409].includes(race[1].status));
    await request(app).patch(`/api/vehicles/${d.id}`).set(auth('a')).send(vehicleData('4')).expect(409);
    const count = await pool.query('SELECT count(*)::int AS count FROM public.appointments WHERE customer_id = ANY($1::uuid[])', [Object.values(ids)]);
    assert.equal(count.rows[0].count, 3);
    await request(app).get(`/api/vehicles/${d.id}`).set(auth('b')).expect(404);
    console.log('Live race checks passed: overlapping slots, shared slot, shared vehicle, edit/booking lock. Temporary fixtures removed in cleanup.');
  } finally {
    try {
      await pool.query('DELETE FROM public.appointments WHERE customer_id = ANY($1::uuid[])', [Object.values(ids)]);
      await pool.query('DELETE FROM public.vehicles WHERE owner_id = ANY($1::uuid[])', [Object.values(ids)]);
      if (slots.length) await pool.query('DELETE FROM public.appointment_slots WHERE id = ANY($1::uuid[])', [slots]);
      await pool.query('DELETE FROM public.profiles WHERE id = ANY($1::uuid[])', [Object.values(ids)]);
      await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [Object.values(ids)]);
    } finally { await pool.end(); }
  }
});
