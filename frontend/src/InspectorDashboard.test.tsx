import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { InspectorDashboard, type Inspection, type ScheduleRow } from './InspectorDashboard';

const row: ScheduleRow = { id: 'a1', status: 'BOOKED', startsAt: '2020-01-01T10:00:00Z', endsAt: '2020-01-01T10:30:00Z', registrationNumber: 'MB123', manufacturer: 'Renault', model: 'Clio', year: 2020, vin: 'VF1AAAAA123456789', inspectionId: null, isMine: false, canStart: true, stationBusy: false, overdue: false };
let data: Inspection;
let rows: ScheduleRow[];
let fetchMock: ReturnType<typeof vi.fn>;
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
beforeEach(() => {
  data = { ...row, id: 'i1', status: 'IN_PROGRESS', startedAt: '2020-01-01T10:05:00Z', completedAt: null, finalResult: null, notes: null,
    items: ['Zavore', 'Luči', 'Pnevmatike', 'Krmiljenje', 'Vzmetenje', 'Emisije', 'Identifikacija vozila'].map((name, i) => ({ id: 'item' + i, category: name, name: 'Preveri ' + name, result: 'NOT_CHECKED', notes: null })) };
  rows = [row];
  fetchMock = vi.fn().mockImplementation(async (url: string, options: { method?: string; body?: string }) => {
    if (url === '/api/appointments') return response(rows);
    if (url.endsWith('/start')) { rows = [{ ...row, status: 'IN_PROGRESS', isMine: true, inspectionId: 'i1', canStart: false, overdue: true }]; return response({ id: 'i1' }, 201); }
    if (options.method === 'PATCH') {
      const body = JSON.parse(options.body!);
      if (url.includes('/items/')) { const item = data.items.find(i => url.endsWith(i.id))!; Object.assign(item, body); return response(item); }
      data.notes = body.notes; return response({ id: 'i1', notes: body.notes });
    }
    return response(data);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('starts a booking and opens its seven unassessed items', async () => {
  const user = userEvent.setup(); render(<InspectorDashboard token="token" />);
  await user.click(await screen.findByRole('button', { name: 'Začni pregled' }));
  expect(await screen.findByRole('heading', { name: 'Pregled · MB123' })).toBeInTheDocument();
  expect(screen.getAllByRole('combobox', { name: /^Ocena/ })).toHaveLength(7);
  expect(screen.getByLabelText('Ocena · Zavore')).toHaveValue('NOT_CHECKED');
  expect(fetchMock).toHaveBeenCalledWith('/api/appointments/a1/start', expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer token' } }));
});
it('disables new starts during overtime and hides actions for another inspector', async () => {
  rows = [{ ...row, status: 'IN_PROGRESS', inspectionId: 'i1', canStart: false, overdue: true, stationBusy: true }, { ...row, id: 'a2', stationBusy: true, canStart: false }];
  render(<InspectorDashboard token="token" />);
  expect(await screen.findByText('Pregled presega načrtovani konec termina.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Začni pregled' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Nadaljuj pregled' })).not.toBeInTheDocument();
});
it('retains conflict explanation and refreshes the schedule after a competing claim', async () => {
  const original = fetchMock.getMockImplementation() as (url: string, options: { method?: string; body?: string }) => Promise<ReturnType<typeof response>>;
  fetchMock.mockImplementation(async (url, options) => url.endsWith('/start') ? response({ error: 'Pregledno mesto je zasedeno.' }, 409) : original(url, options));
  const user = userEvent.setup(); render(<InspectorDashboard token="token" />);
  await user.click(await screen.findByRole('button', { name: 'Začni pregled' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Pregledno mesto je zasedeno');
  expect(fetchMock.mock.calls.filter(call => call[0] === '/api/appointments')).toHaveLength(2);
});
it('explicitly saves scores and notes and restores them when reopened', async () => {
  const user = userEvent.setup(); render(<InspectorDashboard token="token" />);
  await user.click(await screen.findByRole('button', { name: 'Začni pregled' }));
  await user.selectOptions(await screen.findByLabelText('Ocena · Zavore'), 'FAIL');
  await user.type(screen.getByLabelText('Opomba · Zavore'), 'Preverjeno');
  await user.click(within(screen.getByRole('region', { name: 'Zavore' })).getByRole('button', { name: 'Shrani postavko' }));
  await waitFor(() => expect(within(screen.getByRole('region', { name: 'Zavore' })).getByRole('button', { name: 'Shrani postavko' })).toBeDisabled());
  await user.type(screen.getByLabelText('Splošna opomba pregleda'), 'Opomba pregleda');
  await user.click(screen.getByRole('button', { name: 'Shrani opombo' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Shrani opombo' })).toBeDisabled());
  await user.click(screen.getByRole('button', { name: 'Nazaj na razpored' }));
  await user.click(await screen.findByRole('button', { name: 'Nadaljuj pregled' }));
  expect(await screen.findByLabelText('Ocena · Zavore')).toHaveValue('FAIL');
  expect(screen.getByLabelText('Opomba · Zavore')).toHaveValue('Preverjeno');
  expect(screen.getByLabelText('Splošna opomba pregleda')).toHaveValue('Opomba pregleda');
});
it('warns before discarding edits and retains the editor when leaving is cancelled', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const onDirty = vi.fn(); const user = userEvent.setup(); render(<InspectorDashboard token="token" onDirtyChange={onDirty} />);
  await user.click(await screen.findByRole('button', { name: 'Začni pregled' }));
  await user.selectOptions(await screen.findByLabelText('Ocena · Zavore'), 'PASS');
  await user.click(screen.getByRole('button', { name: 'Nazaj na razpored' }));
  expect(confirm).toHaveBeenCalled(); expect(onDirty).toHaveBeenCalledWith(true);
  expect(screen.getByLabelText('Ocena · Zavore')).toHaveValue('PASS');
});
it('opens own completed inspection with disabled inputs and no save actions', async () => {
  rows = [{ ...row, status: 'COMPLETED', isMine: true, inspectionId: 'i1', canStart: false }];
  data.status = 'COMPLETED'; data.completedAt = '2020-01-01T11:00:00Z'; data.finalResult = 'PASSED';
  const user = userEvent.setup(); render(<InspectorDashboard token="token" />);
  await user.click(await screen.findByRole('button', { name: 'Odpri zaključen pregled' }));
  expect(await screen.findByLabelText('Ocena · Zavore')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Shrani postavko' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Shrani opombo' })).not.toBeInTheDocument();
});

it('blocks completion for unsaved edits and switches to read-only after confirmation', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const original = fetchMock.getMockImplementation() as (url: string, options: { method?: string; body?: string }) => Promise<ReturnType<typeof response>>;
  fetchMock.mockImplementation(async (url, options) => url.endsWith('/complete') ? response({ status: 'COMPLETED', finalResult: 'PASSED', completedAt: '2020-01-01T11:00:00Z' }) : original(url, options));
  const user = userEvent.setup(); render(<InspectorDashboard token="token" />);
  await user.click(await screen.findByRole('button', { name: 'Začni pregled' }));
  await user.type(await screen.findByLabelText('Splošna opomba pregleda'), 'Opomba');
  expect(screen.getByRole('button', { name: 'Zaključi pregled' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Shrani opombo' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Zaključi pregled' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Zaključi pregled' }));
  expect(await screen.findByText(/Zaključen pregled · PASSED/)).toBeInTheDocument();
  expect(screen.getByLabelText('Ocena · Zavore')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Zaključi pregled' })).not.toBeInTheDocument();
});
it('retains editable findings after incomplete-completion rejection', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const original = fetchMock.getMockImplementation() as (url: string, options: { method?: string; body?: string }) => Promise<ReturnType<typeof response>>;
  fetchMock.mockImplementation(async (url, options) => url.endsWith('/complete') ? response({ error: 'Pregled ni popoln.' }, 409) : original(url, options));
  const user = userEvent.setup(); render(<InspectorDashboard token="token" />);
  await user.click(await screen.findByRole('button', { name: 'Začni pregled' }));
  await user.click(await screen.findByRole('button', { name: 'Zaključi pregled' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Pregled ni popoln');
  expect(screen.getByLabelText('Ocena · Zavore')).toBeEnabled();
});
