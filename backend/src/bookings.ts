import { Router } from 'express';
import { requireRole } from './auth.js';
import { transaction, type Pool } from './db.js';
import { HttpError, uuid } from './errors.js';

export function slotStart(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) {
    throw new HttpError(400, 'Vnesite veljaven datum in uro s časovnim pasom.', 'startsAt');
  }
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf()) || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    throw new HttpError(400, 'Datum ali ura nista veljavna.', 'startsAt');
  }
  return date.toISOString();
}

export function slotRoutes(pool: Pool) {
  const router = Router();
  router.get('/', requireRole('CUSTOMER', 'ADMIN'), async (_req, res) => {
    const onlyFree = res.locals.profile.role === 'CUSTOMER';
    const result = await pool.query(`SELECT s.id, s.starts_at AS "startsAt", s.ends_at AS "endsAt",
      (s.starts_at > clock_timestamp() AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.slot_id = s.id)) AS available
      FROM public.appointment_slots s ${onlyFree ? 'WHERE s.starts_at > clock_timestamp() AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.slot_id = s.id)' : ''} ORDER BY s.starts_at`);
    res.json(result.rows);
  });
  router.post('/', requireRole('ADMIN'), async (req, res) => {
    const startsAt = slotStart(req.body?.startsAt);
    const result = await pool.query(`INSERT INTO public.appointment_slots (starts_at, ends_at)
      SELECT $1::timestamptz, $1::timestamptz + interval '30 minutes' WHERE $1::timestamptz > clock_timestamp()
      RETURNING id, starts_at AS "startsAt", ends_at AS "endsAt", true AS available`, [startsAt]);
    if (!result.rows[0]) throw new HttpError(400, 'Začetek termina mora biti v prihodnosti.', 'startsAt');
    res.status(201).json(result.rows[0]);
  });
  return router;
}

export function bookingRoutes(pool: Pool) {
  const router = Router();
  router.post('/', requireRole('CUSTOMER'), async (req, res) => {
    const vehicleId = uuid(req.body?.vehicleId, 'vehicleId');
    const slotId = uuid(req.body?.slotId, 'slotId');
    const result = await transaction(pool, async db => {
      const vehicles = await db.query(`SELECT id, registration_number AS "registrationNumber" FROM public.vehicles WHERE id = $1 AND owner_id = $2 FOR UPDATE`, [vehicleId, res.locals.profile.id]);
      if (!vehicles.rows[0]) throw new HttpError(404, 'Vozilo ni dostopno.');
      const slots = await db.query('SELECT id, starts_at AS "startsAt", ends_at AS "endsAt" FROM public.appointment_slots WHERE id = $1 FOR UPDATE', [slotId]);
      if (!slots.rows[0]) throw new HttpError(404, 'Termin ni dostopen.');
      // Re-check time after both locks have been acquired; a waiting request may be late.
      const availability = await db.query(`SELECT 1 FROM public.appointment_slots s WHERE s.id = $1 AND s.starts_at > clock_timestamp()
        AND NOT EXISTS (SELECT 1 FROM public.appointments WHERE slot_id = $1 OR (vehicle_id = $2 AND status IN ('BOOKED', 'IN_PROGRESS')))`, [slotId, vehicleId]);
      if (!availability.rows.length) throw new HttpError(409, 'Termin ni več prost ali pa ima vozilo že odprto rezervacijo. Osvežite izbiro.');
      const appointment = await db.query(`INSERT INTO public.appointments (slot_id, vehicle_id, customer_id) VALUES ($1, $2, $3)
        RETURNING id, slot_id AS "slotId", vehicle_id AS "vehicleId", customer_id AS "customerId", status, created_at AS "createdAt"`, [slotId, vehicleId, res.locals.profile.id]);
      return { ...appointment.rows[0], registrationNumber: vehicles.rows[0].registrationNumber, startsAt: slots.rows[0].startsAt, endsAt: slots.rows[0].endsAt };
    });
    res.status(201).json(result);
  });
  return router;
}
