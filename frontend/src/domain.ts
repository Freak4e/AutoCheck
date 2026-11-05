export type Vehicle = {
  id: string; registrationNumber: string; manufacturer: string; model: string;
  year: number; vin: string; canEdit: boolean; canReserve: boolean;
};
export type Slot = { id: string; startsAt: string; endsAt: string; available: boolean };
export type Booking = { id: string; registrationNumber: string; startsAt: string; endsAt: string; status: 'BOOKED' };
export const dateTime = (value: string) => new Intl.DateTimeFormat('sl-SI', {
  timeZone: 'Europe/Ljubljana', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));
export const time = (value: string) => new Intl.DateTimeFormat('sl-SI', { timeZone: 'Europe/Ljubljana', timeStyle: 'short' }).format(new Date(value));
export async function stationInstant(value: string) {
  try {
    const { Temporal } = await import('@js-temporal/polyfill');
    return Temporal.PlainDateTime.from(value).toZonedDateTime('Europe/Ljubljana', { disambiguation: 'reject' }).toInstant().toString();
  } catch { throw new Error('Vnesite veljaven datum in uro. Ob prehodu na poletni/zimski čas izberite uro, ki obstaja samo enkrat.'); }
}
