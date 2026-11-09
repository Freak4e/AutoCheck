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
    if (options.method === 'PUT') { const body = JSON.parse(options.body!); data = { ...data, ...body, items: data.items.map(item => ({ ...item, ...body.items.find((i: { id: string }) => i.id === item.id) })) }; return response(data); }
    if (url.endsWith('/complete')) return response({ status: 'COMPLETED', finalResult: 'PASSED', completedAt: '2020-01-01T11:00:00Z' });
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
  expect(screen.getAllByRole('radiogroup')).toHaveLength(7);
  expect(screen.getAllByRole('radio').every(input => !(input as HTMLInputElement).checked)).toBe(true);
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

async function openEditor() {
  const user = userEvent.setup(); render(<InspectorDashboard token="token" />);
  await user.click(await screen.findByRole('button', { name: 'Začni pregled' }));
  await screen.findByRole('radiogroup', { name: 'Ocena · Zavore' });
  return user;
}
it('shows defect fields only for failed items and saves scores, defects and notes together', async () => {
  const user = await openEditor();
  expect(screen.queryByLabelText('Opis napake · Zavore')).not.toBeInTheDocument();
  await user.click(within(screen.getByRole('region', { name: 'Zavore' })).getByRole('radio', { name: 'Ni v redu' }));
  expect(screen.getByText('Dopišite opis napake: Zavore.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Shrani pregled' })).toBeDisabled();
  await user.type(screen.getByLabelText('Opis napake · Zavore'), 'Obrabljene zavore');
  await user.selectOptions(screen.getByLabelText('Resnost · Zavore'), 'MAJOR');
  await user.type(screen.getByLabelText('Splošna opomba pregleda (neobvezno)'), 'Opomba');
  await user.click(screen.getByRole('button', { name: 'Shrani pregled' }));
  expect(await screen.findByText('Vse spremembe so shranjene.')).toBeInTheDocument();
  const saved = JSON.parse(fetchMock.mock.calls.find(([url]) => url.endsWith('/checklist'))![1].body);
  expect(saved.notes).toBe('Opomba'); expect(saved.items[0]).toMatchObject({ result: 'FAIL', defects: [{ description: 'Obrabljene zavore', severity: 'MAJOR' }] });
  await user.click(screen.getByRole('button', { name: 'Nazaj na razpored' }));
  await user.click(await screen.findByRole('button', { name: 'Nadaljuj pregled' }));
  expect(await screen.findByLabelText('Opis napake · Zavore')).toHaveValue('Obrabljene zavore');
});
it('shows missing assessments then saves unsaved edits before completing without waiting for the slot end', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  data.startsAt = new Date(Date.now() - 60000).toISOString(); data.endsAt = new Date(Date.now() + 29 * 60000).toISOString();
  const user = await openEditor();
  expect(screen.getByRole('button', { name: 'Shrani in zaključi' })).toBeDisabled();
  for (const radio of screen.getAllByRole('radio', { name: 'V redu' })) await user.click(radio);
  await user.type(screen.getByLabelText('Splošna opomba pregleda (neobvezno)'), 'Končano');
  await user.click(screen.getByRole('button', { name: 'Shrani in zaključi' }));
  expect(await screen.findByText(/Zaključen pregled · PASSED/)).toBeInTheDocument();
  expect(fetchMock.mock.calls.findIndex(([url]) => url.endsWith('/checklist'))).toBeLessThan(fetchMock.mock.calls.findIndex(([url]) => url.endsWith('/complete')));
  expect(screen.getAllByRole('radio').every(input => (input as HTMLInputElement).matches(':disabled'))).toBe(true);
  expect(screen.queryByRole('button', { name: 'Shrani in zaključi' })).not.toBeInTheDocument();
});
it('keeps draft on failed save and never calls complete', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  data.items.forEach(item => item.result = 'PASS');
  const original = fetchMock.getMockImplementation() as (url: string, options: { method?: string; body?: string }) => Promise<ReturnType<typeof response>>;
  fetchMock.mockImplementation((url, options) => url.endsWith('/checklist') ? response({ error: 'Shranjevanje ni uspelo.' }, 503) : original(url, options));
  const user = await openEditor(); await user.type(screen.getByLabelText('Splošna opomba pregleda (neobvezno)'), 'Ohrani');
  await user.click(screen.getByRole('button', { name: 'Shrani in zaključi' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Shranjevanje ni uspelo.');
  expect(screen.getByLabelText('Splošna opomba pregleda (neobvezno)')).toHaveValue('Ohrani');
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/complete'))).toBe(false);
});
it('retains saved editable findings when completion is rejected', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true); data.items.forEach(item => item.result = 'PASS');
  const original = fetchMock.getMockImplementation() as (url: string, options: { method?: string; body?: string }) => Promise<ReturnType<typeof response>>;
  fetchMock.mockImplementation((url, options) => url.endsWith('/complete') ? response({ error: 'Pregled ni popoln.' }, 409) : original(url, options));
  const user = await openEditor(); await user.click(screen.getByRole('button', { name: 'Shrani in zaključi' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Pregled ni popoln.');
  expect(screen.getAllByRole('radio')[0]).toBeEnabled();
});
it('requires confirmation before discarding defect descriptions when switching to PASS', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  data.items[0] = { ...data.items[0], result: 'FAIL', defects: [{ id: 'd1', description: 'Napaka', severity: 'MINOR' }, { id: 'd2', description: 'Druga', severity: 'MAJOR' }] };
  const user = await openEditor(); const pass = within(screen.getByRole('region', { name: 'Zavore' })).getByRole('radio', { name: 'V redu' });
  await user.click(pass); expect(screen.getByLabelText('Opis napake · Zavore')).toHaveValue('Napaka');
  expect(screen.getByLabelText('Opis napake · Zavore (2)')).toHaveValue('Druga');
  confirm.mockReturnValue(true); await user.click(pass);
  expect(screen.queryByLabelText('Opis napake · Zavore')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Shrani pregled' })); await screen.findByText('Vse spremembe so shranjene.');
  expect(data.items[0].defects).toEqual([]);
});
it('warns before leaving an unsaved checklist', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); const user = await openEditor();
  await user.click(screen.getAllByRole('radio', { name: 'V redu' })[0]);
  await user.click(screen.getByRole('button', { name: 'Nazaj na razpored' }));
  expect(confirm).toHaveBeenCalled(); expect(screen.getByRole('heading', { name: 'Pregled · MB123' })).toBeInTheDocument();
});
