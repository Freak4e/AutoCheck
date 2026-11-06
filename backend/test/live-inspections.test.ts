// Explicit live test in a disposable schema. Existing application data is never changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import { readConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { profileStore } from '../src/profiles.js';
import type { Pool } from '../src/db.js';

test('real PostgreSQL arbitrates same/different appointment takeovers and rolls back the loser', async () => {
  const config = readConfig();
  const raw = new pg.Pool({ connectionString: config.databaseUrl, ssl: config.ssl, connectionTimeoutMillis: 10000, max: 5 });
  const schema = 'autocheck_test_' + randomUUID().replaceAll('-', '');
  const rewrite = (sql: string) => sql.replaceAll('public.', schema + '.');
  const pool: Pool = { query: (sql, args) => raw.query(rewrite(sql), args), async connect() {
    const client = await raw.connect(); return { query: (sql, args) => client.query(rewrite(sql), args), release: () => client.release() };
  } };
  const ids = { a: randomUUID(), b: randomUUID(), customer: randomUUID() };
  const app = createApp({ pool, profiles: profileStore(pool), verifyToken: async token => token in ids ? { id: ids[token as keyof typeof ids] } : null });
  let created = false;
  try {
    await raw.query(`CREATE SCHEMA ${schema}`); created = true;
    for (const file of ['schema.sql', 'changes/01-vehicles-slots-appointments.sql', 'changes/02-inspections-checklist.sql']) {
      await pool.query(await readFile(new URL('../../database/' + file, import.meta.url), 'utf8'));
    }
    for (const [name, id] of Object.entries(ids)) {
      await raw.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
      await pool.query('INSERT INTO public.profiles (id, name, role) VALUES ($1, $2, $3)', [id, 'Temporary test', name === 'customer' ? 'CUSTOMER' : 'INSPECTOR']);
    }
    const appointments: string[] = [];
    for (let n = 0; n < 2; n++) {
      const vehicle = (await pool.query(`INSERT INTO public.vehicles (owner_id, registration_number, manufacturer, model, year, vin)
        VALUES ($1, $2, 'Test', 'Fixture', 2020, $3) RETURNING id`, [ids.customer, 'TEST' + n, 'VF1AAAAA12345678' + n])).rows[0];
      const slot = (await pool.query(`INSERT INTO public.appointment_slots (starts_at, ends_at)
        VALUES (now() - ($1 + 60) * interval '1 minute', now() - ($1 + 30) * interval '1 minute') RETURNING id`, [n * 60])).rows[0];
      appointments.push((await pool.query('INSERT INTO public.appointments (slot_id, vehicle_id, customer_id) VALUES ($1, $2, $3) RETURNING id', [slot.id, vehicle.id, ids.customer])).rows[0].id as string);
    }
    const claim = (id: string, user: string) => request(app).post(`/api/appointments/${id}/start`).set('Authorization', 'Bearer ' + user);
    for (const same of [true, false]) {
      const result = await Promise.all([claim(appointments[0], 'a'), claim(appointments[same ? 0 : 1], 'b')]);
      assert.deepEqual(result.map(r => r.status).sort(), [201, 409]);
      assert.equal((await pool.query('SELECT * FROM public.inspections')).rows.length, 1);
      assert.equal((await pool.query('SELECT * FROM public.inspection_items')).rows.length, 7);
      assert.equal((await pool.query("SELECT * FROM public.appointments WHERE status = 'IN_PROGRESS'")).rows.length, 1);
      await pool.query('DELETE FROM public.inspection_items'); await pool.query('DELETE FROM public.inspections');
      await pool.query("UPDATE public.appointments SET status = 'BOOKED'");
    }
    await pool.query('UPDATE public.checklist_template_items SET is_active = false');
    await claim(appointments[0], 'a').expect(409);
    assert.equal((await pool.query('SELECT * FROM public.inspections')).rows.length, 0);
    assert.equal((await pool.query("SELECT * FROM public.appointments WHERE status = 'BOOKED'")).rows.length, 2);
  } finally {
    try {
      if (created && /^autocheck_test_[a-f0-9]{32}$/.test(schema)) await raw.query(`DROP SCHEMA ${schema} CASCADE`);
      await raw.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [Object.values(ids)]);
    } finally { await raw.end(); }
  }
});
