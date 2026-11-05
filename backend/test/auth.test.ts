import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { profileStore } from '../src/profiles.js';

const customer = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const inspector = '10000000-0000-4000-8000-000000000003';
const admin = '10000000-0000-4000-8000-000000000004';
const users: Record<string, string> = { customer, other, inspector, admin };
const db = new PGlite();
const profiles = profileStore(db);
const app = createApp({ profiles, verifyToken: async token => users[token] ? { id: users[token] } : null });
const as = (token: string) => ({ Authorization: `Bearer ${token}` });

before(async () => {
  await db.exec('CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY); CREATE ROLE anon; CREATE ROLE authenticated;');
  await db.exec(await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8'));
});
after(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec('TRUNCATE public.profiles, auth.users;');
  for (const id of Object.values(users)) await db.query('INSERT INTO auth.users VALUES ($1)', [id]);
});

test('API rejects absent, malformed and invalid tokens with 401', async () => {
  for (const headers of [{}, as('expired'), { Authorization: 'Basic abc' }, { Authorization: 'Bearer two tokens' }]) {
    await request(app).get('/api/auth/me').set(headers).expect(401);
  }
  await request(app).post('/api/auth/profile').send({ name: 'Ana' }).expect(401);
});

test('first login creates only verified user as CUSTOMER despite forged ID and role', async () => {
  const result = await request(app).post('/api/auth/profile').set(as('customer'))
    .send({ name: '  Ana Novak  ', id: admin, role: 'ADMIN' }).expect(201);
  assert.equal(result.body.id, customer);
  assert.equal(result.body.name, 'Ana Novak');
  assert.equal(result.body.role, 'CUSTOMER');
  assert.equal(await profiles.find(admin), undefined);
  assert.equal((await profiles.find(customer))?.name, 'Ana Novak');
});

test('blank, missing, non-string or oversized name cannot create a profile', async () => {
  for (const name of [undefined, '', '   ', 42, {}, 'x'.repeat(101)]) {
    await request(app).post('/api/auth/profile').set(as('customer')).send({ name }).expect(400);
    assert.equal(await profiles.find(customer), undefined);
  }
});

test('repeat profile initialization preserves existing staff role and name', async () => {
  await db.query("INSERT INTO profiles (id, name, role) VALUES ($1, 'Preglednik', 'INSPECTOR')", [inspector]);
  const result = await request(app).post('/api/auth/profile').set(as('inspector'))
    .send({ name: 'Changed', role: 'CUSTOMER' }).expect(200);
  assert.equal(result.body.role, 'INSPECTOR');
  assert.equal(result.body.name, 'Preglednik');
  await request(app).post('/api/auth/profile').set(as('inspector')).send({}).expect(200);
});

test('concurrent first logins create exactly one profile without overwriting it', async () => {
  const results = await Promise.all(Array.from({ length: 5 }, () => request(app).post('/api/auth/profile').set(as('customer')).send({ name: 'Ana' })));
  assert.ok(results.every(result => [200, 201].includes(result.status)));
  assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM profiles')).rows[0].count, 1);
});

test('each role can access only its own workspace, regardless of forged headers', async () => {
  for (const [token, role] of [['customer', 'CUSTOMER'], ['inspector', 'INSPECTOR'], ['admin', 'ADMIN']]) {
    await db.query('INSERT INTO profiles (id, name, role) VALUES ($1, $2, $3)', [users[token], token, role]);
    for (const area of ['customer', 'inspector', 'admin']) {
      await request(app).get(`/api/workspace/${area}`).set({ ...as(token), 'X-Role': 'ADMIN' }).expect(area === token ? 200 : 403);
    }
  }
});

test('role is re-read from SQL on each request', async () => {
  await profiles.create(customer, 'Ana');
  await request(app).get('/api/workspace/admin').set(as('customer')).expect(403);
  await db.query("UPDATE profiles SET role = 'ADMIN' WHERE id = $1", [customer]);
  await request(app).get('/api/workspace/admin').set(as('customer')).expect(200);
  await request(app).get('/api/workspace/customer').set(as('customer')).expect(403);
});

test('foreign and nonexistent profiles both return 404 without revealing data', async () => {
  await profiles.create(customer, 'Ana');
  await profiles.create(other, 'Secret name');
  await request(app).get(`/api/auth/profiles/${customer}`).set(as('customer')).expect(200);
  const foreign = await request(app).get(`/api/auth/profiles/${other}`).set(as('customer')).expect(404);
  const missing = await request(app).get('/api/auth/profiles/nonexistent').set(as('customer')).expect(404);
  assert.deepEqual(foreign.body, missing.body);
  assert.ok(!JSON.stringify(foreign.body).includes('Secret'));
});

test('me requires a profile and returns the persisted profile without caching', async () => {
  await request(app).get('/api/auth/me').set(as('customer')).expect(404);
  await profiles.create(customer, 'Ana');
  const result = await request(app).get('/api/auth/me').set(as('customer')).expect(200);
  assert.equal(result.body.name, 'Ana');
  assert.equal(result.headers['cache-control'], 'no-store');
});

test('SQL binds names as data and enforces role and Auth foreign key constraints', async () => {
  const name = "Ana'); DROP TABLE profiles; --";
  await profiles.create(customer, name);
  assert.equal((await profiles.find(customer))?.name, name);
  await assert.rejects(db.query("UPDATE profiles SET role = 'SUPERUSER' WHERE id = $1", [customer]));
  await assert.rejects(profiles.create('20000000-0000-4000-8000-000000000099', 'Unknown'));
});

test('public database roles cannot read or modify profiles directly', async () => {
  await profiles.create(customer, 'Ana');
  await db.exec('GRANT USAGE ON SCHEMA public TO anon, authenticated;');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    try {
      await assert.rejects(db.query('SELECT * FROM profiles'));
      await assert.rejects(db.query("UPDATE profiles SET role = 'ADMIN'"));
    } finally { await db.exec('RESET ROLE'); }
  }
});

test('malformed JSON is a 400 and infrastructure failures never expose secrets', async () => {
  await request(app).post('/api/auth/profile').set(as('customer')).set('Content-Type', 'application/json').send('{').expect(400);
  const failing = createApp({ profiles, verifyToken: async () => { throw new Error('postgres://SECRET'); } });
  const result = await request(failing).get('/api/auth/me').set(as('customer')).expect(503);
  assert.ok(!JSON.stringify(result.body).includes('SECRET'));
});
