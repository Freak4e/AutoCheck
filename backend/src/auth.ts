import type { RequestHandler } from 'express';
import type { Profile, ProfileStore, Role } from './profiles.js';

export type VerifiedUser = { id: string };
export type VerifyToken = (token: string) => Promise<VerifiedUser | null>;

declare global {
  namespace Express {
    interface Locals { user: VerifiedUser; profile: Profile }
  }
}

export function authenticate(verifyToken: VerifyToken): RequestHandler {
  return async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
    if (!match) { res.status(401).json({ error: 'Za dostop se prijavite.' }); return; }
    const user = await verifyToken(match[1]);
    if (!user) { res.status(401).json({ error: 'Prijava ni veljavna. Prijavite se ponovno.' }); return; }
    res.locals.user = user;
    next();
  };
}

export function requireProfile(profiles: ProfileStore): RequestHandler {
  return async (_req, res, next) => {
    const profile = await profiles.find(res.locals.user.id);
    if (!profile) { res.status(404).json({ error: 'Uporabniški profil še ni pripravljen.' }); return; }
    res.locals.profile = profile;
    next();
  };
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (_req, res, next) => {
    if (!roles.includes(res.locals.profile.role)) {
      res.status(403).json({ error: 'Vaša vloga ne dovoljuje tega dejanja.' }); return;
    }
    next();
  };
}
