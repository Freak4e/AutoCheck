import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi, afterEach } from 'vitest';
import { VehicleHistory } from './VehicleHistory';
import { DefectsEditor } from './DefectsEditor';
const cars = [1,2].map(n => ({ id: 'v'+n, registrationNumber: 'MB'+n, manufacturer: 'Renault', model: 'Clio', vin: 'VF1AAAAA123456789', year: 2020, canEdit: false, canReserve: true }));
const detail = { id: 'i1', startedAt: '2020-01-01T10:00:00Z', completedAt: '2020-01-01T11:00:00Z', finalResult: 'REINSPECTION_REQUIRED', status: 'COMPLETED', registrationNumber: 'MB1', inspectorName: 'Preglednik', manufacturer: 'Renault', model: 'Clio', vin: cars[0].vin, year: 2020, notes: null,
  items: [{ id: 'item1', category: 'Zavore', name: 'Preveri zavore', result: 'FAIL', notes: 'Opomba', defects: [{ id: 'd1', description: 'Obraba', severity: 'MINOR' }] }] };
const response = (value: unknown, status = 200) => ({ ok: status < 400, status, json: async () => value });
afterEach(() => { vi.unstubAllGlobals(); });
it('shows vehicle history and read-only findings including defects and reinspection guidance', async () => {
  const fetchMock = vi.fn().mockImplementation(async (url: string) => response(url.startsWith('/api/vehicles/') ? [detail] : detail)); vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup(); render(<VehicleHistory vehicles={cars} token="token" />);
  await user.selectOptions(screen.getByLabelText('Vozilo za zgodovino'), 'v1');
  await user.click(await screen.findByRole('button', { name: /REINSPECTION_REQUIRED/ }));
  expect(await screen.findByText('Obraba')).toBeInTheDocument(); expect(screen.getByText('MINOR')).toBeInTheDocument();
  expect(screen.getByText(/Nov termin ni samodejno rezerviran/)).toBeInTheDocument();
  expect(screen.getByText('Preglednik: Preglednik')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Shrani|Zaključi/ })).not.toBeInTheDocument();
});
it('shows an empty history without an invented result', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([]))); const user = userEvent.setup(); render(<VehicleHistory vehicles={cars} token="token" />);
  await user.selectOptions(screen.getByLabelText('Vozilo za zgodovino'), 'v1');
  expect(await screen.findByText('Vozilo še nima zaključenih pregledov.')).toBeInTheDocument();
  expect(screen.queryByText('PASSED')).not.toBeInTheDocument();
});
it('ignores a late response from the previously selected vehicle', async () => {
  let resolve!: (value: unknown) => void;
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => url.includes('v1') ? new Promise(done => { resolve = done; }) : Promise.resolve(response([]))));
  const user = userEvent.setup(); render(<VehicleHistory vehicles={cars} token="token" />);
  await user.selectOptions(screen.getByLabelText('Vozilo za zgodovino'), 'v1');
  await user.selectOptions(screen.getByLabelText('Vozilo za zgodovino'), 'v2');
  await act(async () => resolve(response([detail])));
  expect(await screen.findByText('Vozilo še nima zaključenih pregledov.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /REINSPECTION_REQUIRED/ })).not.toBeInTheDocument();
});
it('adds, edits and removes a defect; draft changes are reported for the completion guard', async () => {
  const fetchMock = vi.fn().mockImplementation(async (_url: string, options: { method: string; body?: string }) => response({ id: 'd1', ...JSON.parse(options.body ?? '{}') })); vi.stubGlobal('fetch', fetchMock);
  const dirty = vi.fn(); const user = userEvent.setup();
  render(<DefectsEditor initial={[]} token="token" inspectionId="i1" itemId="item1" result="FAIL" canAdd readOnly={false} onDirty={dirty} />);
  await user.type(screen.getByLabelText('Opis nove napake'), 'Napaka'); expect(dirty).toHaveBeenCalledWith(true);
  await user.click(screen.getByRole('button', { name: 'Dodaj napako' }));
  expect(await screen.findByLabelText('Opis napake')).toHaveValue('Napaka');
  await user.selectOptions(screen.getByLabelText('Resnost napake'), 'MAJOR');
  await user.click(screen.getByRole('button', { name: 'Shrani napako' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Shrani napako' })).toBeDisabled());
  await user.click(screen.getByRole('button', { name: 'Odstrani napako' }));
  expect(await screen.findByText('Ni zabeleženih napak.')).toBeInTheDocument();
  expect(screen.getByText(/Neskladje: FAIL/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/inspections/i1/defects/d1', expect.objectContaining({ method: 'DELETE' }));
});
it('cannot add a defect before FAIL is saved and preserves draft after server rejection', async () => {
  const user = userEvent.setup(); const props = { initial: [], token: 'token', inspectionId: 'i1', itemId: 'item1', result: 'PASS', canAdd: false, readOnly: false, onDirty: vi.fn() };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'Pregled je zaključen.' }, 409)));
  const view = render(<DefectsEditor {...props} />); await user.type(screen.getByLabelText('Opis nove napake'), 'Osnutek');
  expect(screen.getByRole('button', { name: 'Dodaj napako' })).toBeDisabled();
  view.rerender(<DefectsEditor {...props} result="FAIL" canAdd />); await user.click(screen.getByRole('button', { name: 'Dodaj napako' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Pregled je zaključen'); expect(screen.getByLabelText('Opis nove napake')).toHaveValue('Osnutek');
});
