import express, { type ErrorRequestHandler } from 'express';
import { authenticate, requireProfile, requireRole, type VerifyToken } from './auth.js';
import type { ProfileStore, Role } from './profiles.js';
import type { Pool } from './db.js';
import { vehicleRoutes } from './vehicles.js';
import { bookingRoutes, slotRoutes } from './bookings.js';
import { HttpError } from './errors.js';
import { inspectorAppointmentRoutes, inspectionRoutes } from './inspections.js';
import { customerRecords } from './customer-records.js';
import { completionRoutes } from './inspection-completion.js';

export function createApp(deps: { verifyToken: VerifyToken; profiles: ProfileStore; pool?: Pool; logError?: (error: unknown) => void }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));
  app.get('/api/health', (_req, res) => { res.json({ status: 'ok' }); });
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', authenticate(deps.verifyToken));

  app.post('/api/auth/profile', async (req, res) => {
    const id = res.locals.user.id;
    const existing = await deps.profiles.find(id);
    if (existing) { res.json(existing); return; }
    const name: unknown = req.body?.name;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
      res.status(400).json({ error: 'Ime je obvezno in sme vsebovati največ 100 znakov.', field: 'name' }); return;
    }
    // Deliberately ignore client-supplied ID and role, including Auth metadata.
    const profile = await deps.profiles.create(id, name.trim());
    res.status(201).json(profile);
  });

  app.use('/api', requireProfile(deps.profiles));
  if (deps.pool) {
    app.use('/api', customerRecords(deps.pool));
    app.use('/api/vehicles', vehicleRoutes(deps.pool));
    app.use('/api/slots', slotRoutes(deps.pool));
    app.use('/api/appointments', bookingRoutes(deps.pool));
    app.use('/api/appointments', inspectorAppointmentRoutes(deps.pool));
    app.use('/api/inspections', inspectionRoutes(deps.pool));
    app.use('/api/inspections', completionRoutes(deps.pool));
  }
  app.get('/api/auth/me', (_req, res) => { res.json(res.locals.profile); });
  app.get('/api/auth/profiles/:id', (req, res) => {
    if (req.params.id !== res.locals.user.id) {
      res.status(404).json({ error: 'Profil ni dostopen.' }); return;
    }
    res.json(res.locals.profile);
  });

  const workspaces: { path: string; role: Role; title: string }[] = [
    { path: 'customer', role: 'CUSTOMER', title: 'Moja vozila' },
    { path: 'inspector', role: 'INSPECTOR', title: 'Razpored pregledov' },
    { path: 'admin', role: 'ADMIN', title: 'Evidence postaje' },
  ];
  for (const workspace of workspaces) {
    app.get(`/api/workspace/${workspace.path}`, requireRole(workspace.role), (_req, res) => {
      res.json({ title: workspace.title, profile: res.locals.profile });
    });
  }
  app.use((_req, res) => { res.status(404).json({ error: 'Pot ne obstaja.' }); });
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message, ...(error.field ? { field: error.field } : {}) }); return;
    }
    if (error?.code === '23505') {
      if (error.constraint === 'appointments_one_active_station' || error.constraint === 'inspections_appointment_id_key') {
        res.status(409).json({ error: 'Začetek ni mogoč: pregledno mesto je zasedeno ali je rezervacija že prevzeta.' }); return;
      }
      res.status(409).json({ error: 'Zapis s temi podatki že obstaja ali pa je rezervacija že zasedena.' }); return;
    }
    if (error?.code === '23P01') {
      res.status(409).json({ error: 'Termin se prekriva z obstoječim terminom.' }); return;
    }
    if (error?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Zahteva vsebuje neveljaven JSON.' }); return;
    }
    if (error?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Zahteva je prevelika.' }); return;
    }
    deps.logError?.(error);
    res.status(503).json({ error: 'Storitev trenutno ni dosegljiva. Poskusite ponovno.' });
  };
  app.use(errorHandler);
  return app;
}
