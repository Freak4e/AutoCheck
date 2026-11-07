import { Router } from 'express';
import { requireRole } from './auth.js';
import { transaction, type Pool } from './db.js';
import { HttpError, uuid } from './errors.js';
import { ownInspection } from './inspections.js';

function defectInput(body: { description?: unknown; severity?: unknown } | undefined) {
  if (typeof body?.description !== 'string' || !body.description.trim() || body.description.trim().length > 2000) throw new HttpError(400, 'Opis napake je obvezen (največ 2000 znakov).', 'description');
  if (body.severity !== 'MINOR' && body.severity !== 'MAJOR') throw new HttpError(400, 'Izberite resnost MINOR ali MAJOR.', 'severity');
  return { description: body.description.trim(), severity: body.severity };
}
export function completionRoutes(pool: Pool) {
  const router = Router(); router.use(requireRole('INSPECTOR'));
  router.post('/:id/items/:itemId/defects', async (req, res) => {
    const id = uuid(req.params.id); const itemId = uuid(req.params.itemId);
    const result = await transaction(pool, async db => {
      await ownInspection(db, id, res.locals.profile.id, true);
      const item = (await db.query('SELECT result FROM public.inspection_items WHERE id = $1 AND inspection_id = $2', [itemId, id])).rows[0];
      if (!item) throw new HttpError(404, 'Postavka ni dostopna.');
      if (item.result !== 'FAIL') throw new HttpError(409, 'Pred dodajanjem napake shranite oceno FAIL.');
      const value = defectInput(req.body);
      return (await db.query(`INSERT INTO public.defects (inspection_item_id, description, severity) VALUES ($1, $2, $3) RETURNING id, description, severity`, [itemId, value.description, value.severity])).rows[0];
    });
    res.status(201).json(result);
  });
  for (const method of ['patch', 'delete'] as const) router[method]('/:id/defects/:defectId', async (req, res) => {
    const id = uuid(req.params.id); const defectId = uuid(req.params.defectId);
    const result = await transaction(pool, async db => {
      await ownInspection(db, id, res.locals.profile.id, true);
      if (!(await db.query(`SELECT d.id FROM public.defects d JOIN public.inspection_items item ON item.id = d.inspection_item_id
        WHERE d.id = $1 AND item.inspection_id = $2`, [defectId, id])).rows.length) throw new HttpError(404, 'Napaka ni dostopna.');
      if (method === 'delete') { await db.query('DELETE FROM public.defects WHERE id = $1', [defectId]); return { id: defectId }; }
      const value = defectInput(req.body);
      return (await db.query('UPDATE public.defects SET description = $2, severity = $3 WHERE id = $1 RETURNING id, description, severity', [defectId, value.description, value.severity])).rows[0];
    });
    res.json(result);
  });
  router.post('/:id/complete', async (req, res) => {
    const id = uuid(req.params.id);
    const result = await transaction(pool, async db => {
      const inspection = await ownInspection(db, id, res.locals.profile.id, true);
      const items = (await db.query(`SELECT item.id, item.result, count(d.id)::int AS count,
        coalesce(bool_or(d.severity = 'MAJOR'), false) AS major
        FROM public.inspection_items item LEFT JOIN public.defects d ON d.inspection_item_id = item.id
        WHERE item.inspection_id = $1 GROUP BY item.id`, [id])).rows;
      if (!items.length || items.some(i => i.result === 'NOT_CHECKED' || (i.result === 'FAIL' && i.count === 0) || (i.result === 'PASS' && i.count !== 0))) {
        throw new HttpError(409, 'Pregled ni popoln: ocenite vse postavke; FAIL zahteva napako, PASS mora biti brez napak.');
      }
      const finalResult = items.some(i => i.major) ? 'FAILED' : items.some(i => Number(i.count) > 0) ? 'REINSPECTION_REQUIRED' : 'PASSED';
      const saved = (await db.query(`UPDATE public.inspections SET final_result = $2, completed_at = clock_timestamp()
        WHERE id = $1 RETURNING id, final_result AS "finalResult", completed_at AS "completedAt"`, [id, finalResult])).rows[0];
      await db.query("UPDATE public.appointments SET status = 'COMPLETED' WHERE id = $1", [inspection.appointmentId]);
      return { ...saved, status: 'COMPLETED' };
    });
    res.json(result);
  });
  return router;
}
