import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi, afterEach } from 'vitest';
import { AdminRecords } from './AdminRecords';
const cars = [1,2].map(n => ({ id: 'v'+n, registrationNumber: 'MB'+n, manufacturer: 'Renault', model: 'Clio', vin: 'VF1AAAAA123456789', year: 2020 }));
const bookings = cars.map((v,i) => ({ id: 'a'+i, vehicleId: v.id, registrationNumber: v.registrationNumber, startsAt: '2026-11-08T10:00:00Z', endsAt: '2026-11-08T10:30:00Z', status: i ? 'IN_PROGRESS' : 'BOOKED', inspectionId: i ? 'i1' : null }));
const inspection = { ...cars[1], id: 'i1', vehicleId: 'v2', startedAt: bookings[1].startsAt, status: 'IN_PROGRESS', finalResult: null, completedAt: null, inspectorName: 'Preglednik', notes: 'Opomba pregleda', items: [{ id: 'item', category: 'Zavore', name: 'Preveri zavore', result: 'FAIL', notes: 'Opomba postavke', defects: [{ id: 'd1', description: 'Obraba', severity: 'MAJOR' }] }] };
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
function mock(detail: unknown = inspection) { vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => response(url === '/api/vehicles' ? cars : url === '/api/appointments' ? bookings : url === '/api/inspections' ? [{ ...inspection, id: 'i1' }] : detail))); }
afterEach(() => vi.unstubAllGlobals());
it('links vehicles and reservations, explains BOOKED and reads active findings without editing controls', async () => {
  mock(); const user = userEvent.setup(); render(<AdminRecords token="token" />);
  expect(await screen.findByText('Pregled še ni začet')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Rezervacije in pregledi vozila MB2' }));
  expect(screen.queryByText('Pregled še ni začet')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Odpri pregled rezervacije MB2' }));
  const detail = await screen.findByRole('article', { name: 'Podrobnosti pregleda' });
  expect(within(detail).getByText('Obraba')).toBeInTheDocument(); expect(within(detail).getByText('MAJOR')).toBeInTheDocument();
  expect(within(detail).getByText('Pregled poteka; končni izid še ni določen.')).toBeInTheDocument();
  expect(within(detail).queryByRole('button')).not.toBeInTheDocument(); expect(within(detail).queryByRole('textbox')).not.toBeInTheDocument();
});
it('reads completed result, inspector, notes and defects from the inspection list', async () => {
  mock({ ...inspection, status: 'COMPLETED', finalResult: 'FAILED', completedAt: '2026-11-08T10:25:00Z' });
  const user = userEvent.setup(); render(<AdminRecords token="token" />);
  await user.click(await screen.findByRole('button', { name: /MB2.*Pregled poteka/ }));
  expect(await screen.findByText('FAILED')).toBeInTheDocument(); expect(screen.getByText('Preglednik: Preglednik')).toBeInTheDocument(); expect(screen.getByText('Opomba postavke')).toBeInTheDocument();
});
it('explains all empty lists', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([]))); render(<AdminRecords token="token" />);
  expect(await screen.findByText('Ni vnesenih vozil.')).toBeInTheDocument(); expect(screen.getByText('Ni rezervacij.')).toBeInTheDocument(); expect(screen.getByText('Ni pregledov.')).toBeInTheDocument();
});
it('allows retry after a failed list request', async () => {
  const fetch = vi.fn().mockResolvedValue(response({ error: 'Napaka povezave.' }, 503)); vi.stubGlobal('fetch', fetch);
  const user = userEvent.setup(); render(<AdminRecords token="token" />); expect(await screen.findByRole('alert')).toHaveTextContent('Napaka povezave.');
  fetch.mockResolvedValue(response([])); await user.click(screen.getByRole('button', { name: 'Osveži evidence' })); expect(await screen.findByText('Ni pregledov.')).toBeInTheDocument();
});
it('discards a late detail after selecting another vehicle', async () => {
  let resolve!: (value: unknown) => void;
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => url.includes('/inspections/') ? new Promise(done => { resolve = done; }) : Promise.resolve(response(url === '/api/vehicles' ? cars : url === '/api/appointments' ? bookings : []))));
  const user = userEvent.setup(); render(<AdminRecords token="token" />);
  await user.click(await screen.findByRole('button', { name: 'Odpri pregled rezervacije MB2' }));
  await user.selectOptions(screen.getByLabelText('Filter vozila'), 'v1');
  await act(async () => resolve(response(inspection)));
  expect(screen.queryByText('Obraba')).not.toBeInTheDocument();
});
