import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { profileStore } from './profiles.js';

try {
  const config = readConfig();
  const pool = new pg.Pool({ connectionString: config.databaseUrl, ssl: config.ssl, connectionTimeoutMillis: 10000 });
  pool.on('error', () => { console.error('Povezava z bazo je bila prekinjena.'); });
  const supabase = createClient(config.supabaseUrl, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const app = createApp({
    profiles: profileStore(pool),
    verifyToken: async token => {
      const { data, error } = await supabase.auth.getUser(token);
      if (error) {
        if (error.status === 0 || (error.status ?? 500) >= 500) throw new Error('Auth unavailable');
        return null;
      }
      return data.user ? { id: data.user.id } : null;
    },
    logError: () => { console.error('Zahteva ni uspela. Preverite povezavo z Auth in bazo ter pripravo sheme.'); },
  });
  const server = app.listen(config.port, '127.0.0.1', () => {
    console.log(`AutoCheck API: http://localhost:${config.port}`);
  });
  server.on('error', () => { console.error('Strežnika ni mogoče zagnati; preverite, ali so vrata prosta.'); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { server.close(() => { void pool.end(); }); });
  }
} catch (error) {
  // Configuration errors never include connection strings or credentials.
  console.error(error instanceof Error && !error.message.includes('://') ? error.message : 'Preverite nastavitve v backend/.env.');
  process.exitCode = 1;
}
