import { Router } from 'express';
import { requireRole } from './auth.js';
import { transaction, type Pool } from './db.js';
import type { Database } from './profiles.js';
import { HttpError, uuid } from './errors.js';
import { customerInspection, inspectionItems } from './customer-records.js';

const scheduleFields = `a.id, a.status, s.starts_at AS "startsAt", s.ends_at AS "endsAt",
 v.id AS "vehicleId", v.registration_number AS "registrationNumber", v.manufacturer, v.model, v.year, v.vin,
 i.id AS "inspectionId", coalesce(i.inspector_id = $1, false) AS "isMine",
 (a.status = 'IN_PROGRESS' AND s.ends_at < clock_timestamp()) AS overdue,
 EXISTS (SELECT 1 FROM public.appointments busy WHERE busy.status = 'IN_PROGRESS') AS "stationBusy",
 (a.status = 'BOOKED' AND s.starts_at <= clock_timestamp()
 AND NOT EXISTS (SELECT 1 FROM public.appointments busy WHERE busy.status = 'IN_PROGRESS')) AS "canStart"`;
const scheduleFrom = `FROM public.appointments a JOIN public.appointment_slots s ON s.id = a.slot_id
 JOIN public.vehicles v ON v.id = a.vehicle_id LEFT JOIN public.inspections i ON i.appointment_id = a.id`;

export function inspectorAppointmentRoutes(pool: Pool) {
  const router = Router();
  router.use(requireRole('INSPECTOR'));
  router.get('/', async (_req, res) => {
    res.json((await pool.query(`SELECT ${scheduleFields} ${scheduleFrom} ORDER BY s.starts_at, a.id`, [res.locals.profile.id])).rows);
  });
  router.get('/:id', async (req, res) => {
    const result = await pool.query(`SELECT ${scheduleFields} ${scheduleFrom} WHERE a.id = $2`, [res.locals.profile.id, uuid(req.params.id)]);
    if (!result.rows[0]) throw new HttpError(404, 'Rezervacija ni dostopna.');
    res.json(result.rows[0]);
  });
  router.post('/:id/start', async (req, res) => {
    const id = uuid(req.params.id);
    const inspection = await transaction(pool, async db => {
      const appointment = (await db.query(`SELECT a.status, s.starts_at <= clock_timestamp() AS arrived
        FROM public.appointments a JOIN public.appointment_slots s ON s.id = a.slot_id WHERE a.id = $1 FOR UPDATE OF a`, [id])).rows[0];
      if (!appointment) throw new HttpError(404, 'Rezervacija ni dostopna.');
      if (appointment.status !== 'BOOKED') throw new HttpError(409, 'Rezervacija je že prevzeta ali zaključena.');
      if (!appointment.arrived) throw new HttpError(409, 'Pregleda pred začetkom termina ni mogoče prevzeti.');
      if ((await db.query("SELECT id FROM public.appointments WHERE status = 'IN_PROGRESS' LIMIT 1")).rows.length) {
        throw new HttpError(409, 'Začetek ni mogoč: pregledno mesto je zasedeno.');
      }
      // The partial unique index on IN_PROGRESS arbitrates simultaneous starts
      // of different appointments. Any losing transaction rolls back completely.
      await db.query("UPDATE public.appointments SET status = 'IN_PROGRESS' WHERE id = $1", [id]);
      const created = (await db.query(`INSERT INTO public.inspections (appointment_id, inspector_id) VALUES ($1, $2)
        RETURNING id`, [id, res.locals.profile.id])).rows[0];
      const copied = await db.query(`INSERT INTO public.inspection_items (inspection_id, template_item_id, category, name, sort_order)
        SELECT $1, id, category, name, sort_order FROM public.checklist_template_items WHERE is_active ORDER BY sort_order RETURNING id`, [created.id]);
      if (!copied.rows.length) throw new HttpError(409, 'Predloga nima aktivnih postavk. Prevzem ni bil shranjen.');
      return { id: created.id, appointmentId: id, status: 'IN_PROGRESS' };
    });
    res.status(201).json(inspection);
  });
  return router;
}

export async function ownInspection(db: Database, id: string, inspectorId: string, lock = false) {
  const row = (await db.query(`SELECT i.id, i.appointment_id AS "appointmentId", a.status,
    i.started_at AS "startedAt", i.completed_at AS "completedAt", i.final_result AS "finalResult", i.notes,
    s.starts_at AS "startsAt", s.ends_at AS "endsAt", v.registration_number AS "registrationNumber", v.manufacturer, v.model, v.year, v.vin
    FROM public.inspections i JOIN public.appointments a ON a.id = i.appointment_id
    JOIN public.appointment_slots s ON s.id = a.slot_id JOIN public.vehicles v ON v.id = a.vehicle_id
    WHERE i.id = $1 AND i.inspector_id = $2 ${lock ? 'FOR UPDATE OF a' : ''}`, [id, inspectorId])).rows[0];
  if (!row) throw new HttpError(404, 'Pregled ni dostopen.');
  if (lock && row.status !== 'IN_PROGRESS') throw new HttpError(409, 'Zaključenega pregleda ni mogoče spreminjati.');
  return row;
}

function notes(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > 2000) throw new HttpError(400, 'Opomba sme vsebovati največ 2000 znakov.', 'notes');
  return value.trim() || null;
}

export function inspectionRoutes(pool: Pool) {
  const router = Router();
  router.get('/:id', async (req, res, next) => {
    if (!['CUSTOMER', 'ADMIN'].includes(res.locals.profile.role)) { next(); return; }
    res.json(await customerInspection(pool, uuid(req.params.id), res.locals.profile.id, res.locals.profile.role === 'ADMIN'));
  });
  router.use(requireRole('INSPECTOR'));
  router.get('/:id', async (req, res) => {
    const id = uuid(req.params.id);
    const inspection = await ownInspection(pool, id, res.locals.profile.id);
    const items = await inspectionItems(pool, id);
    res.json({ ...inspection, items });
  });
  router.patch('/:id', async (req, res) => {
    const id = uuid(req.params.id);
    const result = await transaction(pool, async db => {
      await ownInspection(db, id, res.locals.profile.id, true);
      if (!Object.hasOwn(req.body ?? {}, 'notes')) throw new HttpError(400, 'Podajte opombo.', 'notes');
      return (await db.query('UPDATE public.inspections SET notes = $2 WHERE id = $1 RETURNING id, notes', [id, notes(req.body.notes)])).rows[0];
    });
    res.json(result);
  });
  router.patch('/:id/items/:itemId', async (req, res) => {
    const id = uuid(req.params.id); const itemId = uuid(req.params.itemId);
    const result = await transaction(pool, async db => {
      await ownInspection(db, id, res.locals.profile.id, true);
      if (!(await db.query('SELECT id FROM public.inspection_items WHERE id = $1 AND inspection_id = $2', [itemId, id])).rows.length) throw new HttpError(404, 'Postavka ni dostopna.');
      if (!['PASS', 'FAIL', 'NOT_CHECKED'].includes(req.body?.result)) throw new HttpError(400, 'Izberite veljavno oceno.', 'result');
      return (await db.query(`UPDATE public.inspection_items SET result = $3, notes = $4 WHERE id = $1 AND inspection_id = $2
        RETURNING id, result, notes`, [itemId, id, req.body.result, notes(req.body.notes)])).rows[0];
    });
    res.json(result);
  });
  return router;
}
