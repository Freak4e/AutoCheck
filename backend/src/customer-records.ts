import { Router } from 'express';
import type { Database } from './profiles.js';
import { HttpError, uuid } from './errors.js';
import { requireRole } from './auth.js';

export async function inspectionItems(db: Database, id: string) {
  return (await db.query(`SELECT item.id, item.category, item.name, item.sort_order AS "sortOrder", item.result, item.notes,
    coalesce(json_agg(json_build_object('id', d.id, 'description', d.description, 'severity', d.severity) ORDER BY d.id) FILTER (WHERE d.id IS NOT NULL), '[]'::json) AS defects
    FROM public.inspection_items item LEFT JOIN public.defects d ON d.inspection_item_id = item.id
    WHERE item.inspection_id = $1 GROUP BY item.id ORDER BY item.sort_order, item.id`, [id])).rows;
}
export async function customerInspection(db: Database, id: string, owner: string, admin = false) {
  const row = (await db.query(`SELECT i.id, i.started_at AS "startedAt", i.completed_at AS "completedAt", i.final_result AS "finalResult", i.notes,
    p.name AS "inspectorName", a.status, a.vehicle_id AS "vehicleId", v.registration_number AS "registrationNumber", v.manufacturer, v.model, v.year, v.vin,
    s.starts_at AS "startsAt", s.ends_at AS "endsAt"
    FROM public.inspections i JOIN public.appointments a ON a.id = i.appointment_id
    JOIN public.vehicles v ON v.id = a.vehicle_id JOIN public.profiles p ON p.id = i.inspector_id
    JOIN public.appointment_slots s ON s.id = a.slot_id
    WHERE i.id = $1 ${admin ? '' : "AND v.owner_id = $2 AND a.status = 'COMPLETED' AND i.completed_at IS NOT NULL"}`, admin ? [id] : [id, owner])).rows[0];
  if (!row) throw new HttpError(404, 'Pregled ni dostopen.');
  return { ...row, items: await inspectionItems(db, id) };
}
export function customerRecords(db: Database) {
  const router = Router();
  for (const path of ['/appointments', '/appointments/:id']) router.get(path, async (req, res, next) => {
    if (res.locals.profile.role !== 'CUSTOMER') { next(); return; }
    const id = req.params.id ? uuid(req.params.id) : null;
    const rows = (await db.query(`SELECT a.id, a.vehicle_id AS "vehicleId", a.status,
      s.starts_at AS "startsAt", s.ends_at AS "endsAt",
      v.registration_number AS "registrationNumber", v.manufacturer, v.model,
      (a.status = 'BOOKED' AND s.starts_at <= now()) AS delayed
      FROM public.appointments a JOIN public.vehicles v ON v.id = a.vehicle_id
      JOIN public.appointment_slots s ON s.id = a.slot_id
      WHERE a.customer_id = $1 AND v.owner_id = $1 AND a.status IN ('BOOKED', 'IN_PROGRESS')
      ${id ? 'AND a.id = $2' : ''} ORDER BY s.starts_at, a.id`, id ? [res.locals.profile.id, id] : [res.locals.profile.id])).rows;
    if (id && !rows[0]) throw new HttpError(404, 'Rezervacija ni dostopna.');
    res.json(id ? rows[0] : rows);
  });
  for (const path of ['/appointments', '/appointments/:id']) router.get(path, async (req, res, next) => {
    if (res.locals.profile.role !== 'ADMIN') { next(); return; }
    const id = req.params.id ? uuid(req.params.id) : null;
    const rows = (await db.query(`SELECT a.id, a.vehicle_id AS "vehicleId", a.status, s.starts_at AS "startsAt", s.ends_at AS "endsAt",
      v.registration_number AS "registrationNumber", v.manufacturer, v.model, i.id AS "inspectionId"
      FROM public.appointments a JOIN public.vehicles v ON v.id = a.vehicle_id JOIN public.appointment_slots s ON s.id = a.slot_id
      LEFT JOIN public.inspections i ON i.appointment_id = a.id ${id ? 'WHERE a.id = $1' : ''} ORDER BY s.starts_at`, id ? [id] : [])).rows;
    if (id && !rows[0]) throw new HttpError(404, 'Rezervacija ni dostopna.');
    res.json(id ? rows[0] : rows);
  });
  router.get('/inspections', requireRole('ADMIN'), async (_req, res) => {
    res.json((await db.query(`SELECT i.id, i.appointment_id AS "appointmentId", a.vehicle_id AS "vehicleId", a.status,
      i.started_at AS "startedAt", i.completed_at AS "completedAt", i.final_result AS "finalResult", v.registration_number AS "registrationNumber"
      FROM public.inspections i JOIN public.appointments a ON a.id = i.appointment_id JOIN public.vehicles v ON v.id = a.vehicle_id ORDER BY i.started_at DESC`)).rows);
  });
  router.get('/vehicles/:id/inspections', requireRole('CUSTOMER'), async (req, res) => {
    const id = uuid(req.params.id);
    if (!(await db.query('SELECT id FROM public.vehicles WHERE id = $1 AND owner_id = $2', [id, res.locals.profile.id])).rows.length) throw new HttpError(404, 'Vozilo ni dostopno.');
    res.json((await db.query(`SELECT i.id, i.started_at AS "startedAt", i.completed_at AS "completedAt", i.final_result AS "finalResult"
      FROM public.inspections i JOIN public.appointments a ON a.id = i.appointment_id
      WHERE a.vehicle_id = $1 AND a.status = 'COMPLETED' AND i.completed_at IS NOT NULL ORDER BY i.completed_at DESC, i.id`, [id])).rows);
  });
  return router;
}
