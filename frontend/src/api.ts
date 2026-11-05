export type Role = 'CUSTOMER' | 'INSPECTOR' | 'ADMIN';
export type Profile = { id: string; name: string; role: Role; createdAt: string };
export class ApiError extends Error {
  constructor(message: string, public status: number, public field?: string) { super(message); }
}
export async function api<T>(path: string, token: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET', signal: options.signal,
    headers: { Authorization: `Bearer ${token}`, ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error ?? 'Strežnik trenutno ni dosegljiv.', response.status, data.field);
  return data as T;
}
