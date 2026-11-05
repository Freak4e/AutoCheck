import 'dotenv/config';
import { readFileSync } from 'node:fs';

export function readConfig() {
  const required = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'DATABASE_URL'] as const;
  const missing = required.filter(key => !process.env[key] || /PROJECT_REF|YOUR_PUBLISHABLE_KEY|SESSION_POOLER_HOST/.test(process.env[key]!));
  if (missing.length) throw new Error(`V backend/.env izpolnite: ${missing.join(', ')}. Navodila so v README.md.`);
  const databaseUrl = new URL(process.env.DATABASE_URL!);
  if (['sslmode', 'sslcert', 'sslkey', 'sslrootcert'].some(key => databaseUrl.searchParams.has(key))) {
    throw new Error('Iz DATABASE_URL odstranite SSL parametre. Za CA uporabite DATABASE_CA_CERT_PATH; preverjanje TLS je obvezno.');
  }
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT mora biti celo število med 1 in 65535.');
  return {
    supabaseUrl: process.env.SUPABASE_URL!, key: process.env.SUPABASE_PUBLISHABLE_KEY!,
    databaseUrl: databaseUrl.toString(), port,
    ssl: { rejectUnauthorized: true, ...(process.env.DATABASE_CA_CERT_PATH ? { ca: readFileSync(process.env.DATABASE_CA_CERT_PATH, 'utf8') } : {}) },
  };
}
