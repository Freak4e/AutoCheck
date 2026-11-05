export class HttpError extends Error {
  constructor(public status: number, message: string, public field?: string) { super(message); }
}
export function uuid(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, 'Izberite veljaven zapis.', field);
  }
  return value;
}
