import { Router } from 'express';
import { requireRole } from './auth.js';
import { transaction, type Pool } from './db.js';
import { HttpError, uuid } from './errors.js';

const fields = `v.id, v.owner_id AS "ownerId", v.registration_number AS "registrationNumber",
 v.manufacturer, v.model, v.year, v.vin,
 NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.vehicle_id = v.id) AS "canEdit",
 NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.vehicle_id = v.id AND a.status IN ('BOOKED', 'IN_PROGRESS')) AS "canReserve"`;

export function vehicleInput(body: unknown) {
  const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const text = (key: string, max: number) => {
    const value = data[key];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
      throw new HttpError(400, `Polje je obvezno in sme vsebovati največ ${max} znakov.`, key);
    }
    return value.trim();
  };
  const rawRegistration = data.registrationNumber;
  const registrationNumber = typeof rawRegistration === 'string' ? rawRegistration.replace(/[\s-]/g, '').toUpperCase() : '';
  if (!registrationNumber || registrationNumber.length > 20) throw new HttpError(400, 'Vnesite registrsko oznako z največ 20 znaki brez presledkov in vezajev.', 'registrationNumber');
  const manufacturer = text('manufacturer', 60);
  const model = text('model', 60);
  const year = data.year;
  const currentYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Ljubljana', year: 'numeric' }).format(new Date()));
  if (typeof year !== 'number' || !Number.isInteger(year) || year < 1900 || year > currentYear + 1) {
    throw new HttpError(400, `Letnik mora biti celo število med 1900 in ${currentYear + 1}.`, 'year');
  }
  const vin = text('vin', 17).toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new HttpError(400, 'VIN mora imeti 17 znakov: številke in črke brez I, O in Q.', 'vin');
  return { registrationNumber, manufacturer, model, year, vin };
}

export function vehicleRoutes(pool: Pool) {
  const router = Router();
  router.get('/', requireRole('CUSTOMER', 'ADMIN'), async (_req, res) => {
    const profile = res.locals.profile;
    const result = await pool.query(`SELECT ${fields} FROM public.vehicles v ${profile.role === 'ADMIN' ? '' : 'WHERE v.owner_id = $1'} ORDER BY v.registration_number`, profile.role === 'ADMIN' ? [] : [profile.id]);
    res.json(result.rows);
  });
  router.get('/:id', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
    const id = uuid(req.params.id);
    const profile = res.locals.profile;
    const result = await pool.query(`SELECT ${fields} FROM public.vehicles v WHERE v.id = $1 ${profile.role === 'ADMIN' ? '' : 'AND v.owner_id = $2'}`, profile.role === 'ADMIN' ? [id] : [id, profile.id]);
    if (!result.rows[0]) throw new HttpError(404, 'Vozilo ni dostopno.');
    res.json(result.rows[0]);
  });
  router.post('/', requireRole('CUSTOMER'), async (req, res) => {
    const value = vehicleInput(req.body);
    const result = await pool.query(`INSERT INTO public.vehicles (owner_id, registration_number, manufacturer, model, year, vin)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [res.locals.profile.id, ...Object.values(value)]);
    const vehicle = await pool.query(`SELECT ${fields} FROM public.vehicles v WHERE v.id = $1`, [result.rows[0].id]);
    res.status(201).json(vehicle.rows[0]);
  });
  router.patch('/:id', requireRole('CUSTOMER'), async (req, res) => {
    const id = uuid(req.params.id);
    const updated = await transaction(pool, async db => {
      // Booking locks this same vehicle before creating an appointment.
      const current = await db.query('SELECT id FROM public.vehicles WHERE id = $1 AND owner_id = $2 FOR UPDATE', [id, res.locals.profile.id]);
      if (!current.rows[0]) throw new HttpError(404, 'Vozilo ni dostopno.');
      const bookings = await db.query('SELECT 1 FROM public.appointments WHERE vehicle_id = $1 LIMIT 1', [id]);
      if (bookings.rows.length) throw new HttpError(409, 'Vozila po prvi rezervaciji ni več mogoče spreminjati.');
      const value = vehicleInput(req.body);
      await db.query(`UPDATE public.vehicles SET registration_number = $2, manufacturer = $3, model = $4, year = $5, vin = $6 WHERE id = $1`, [id, ...Object.values(value)]);
      return (await db.query(`SELECT ${fields} FROM public.vehicles v WHERE v.id = $1`, [id])).rows[0];
    });
    res.json(updated);
  });
  return router;
}
