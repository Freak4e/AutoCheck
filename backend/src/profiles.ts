export type Role = 'CUSTOMER' | 'INSPECTOR' | 'ADMIN';
export type Profile = { id: string; name: string; role: Role; createdAt: Date };
export interface Database {
  query<T extends Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

export function profileStore(db: Database) {
  const select = 'SELECT id, name, role, created_at AS "createdAt" FROM public.profiles WHERE id = $1';
  return {
    async find(id: string): Promise<Profile | undefined> {
      return (await db.query<Profile>(select, [id])).rows[0];
    },
    async create(id: string, name: string): Promise<Profile> {
      // A competing first login must never overwrite an existing name or staff role.
      await db.query("INSERT INTO public.profiles (id, name, role) VALUES ($1, $2, 'CUSTOMER') ON CONFLICT (id) DO NOTHING", [id, name]);
      const profile = (await db.query<Profile>(select, [id])).rows[0];
      if (!profile) throw new Error('Profile creation failed');
      return profile;
    },
  };
}
export type ProfileStore = ReturnType<typeof profileStore>;
