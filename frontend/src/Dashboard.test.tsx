import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { CustomerDashboard } from './CustomerDashboard';
import { AdminDashboard } from './AdminDashboard';
import { stationInstant } from './domain';

const car = { id: 'car-1', registrationNumber: 'MB123', manufacturer: 'Renault', model: 'Clio', year: 2020, vin: 'VF1AAAAA123456789', canEdit: true, canReserve: true };
const slot = { id: 'slot-1', startsAt: '2030-06-15T08:00:00Z', endsAt: '2030-06-15T08:30:00Z', available: true };
let fetchMock: ReturnType<typeof vi.fn>;
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
beforeEach(() => {
  fetchMock = vi.fn().mockImplementation(async (url: string) => response(url === '/api/vehicles' ? [car] : [slot]));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it('loads owned vehicles and populates an editable vehicle form', async () => {
  const user = userEvent.setup(); render(<CustomerDashboard token="token" />);
  await user.click(await screen.findByRole('button', { name: 'Popravi podatke' }));
  expect(screen.getByLabelText('VIN')).toHaveValue(car.vin);
  await user.clear(screen.getByLabelText('Model')); await user.type(screen.getByLabelText('Model'), 'Megane');
  await user.click(screen.getByRole('button', { name: 'Shrani vozilo' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/vehicles/car-1', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ registrationNumber: car.registrationNumber, manufacturer: car.manufacturer, model: 'Megane', year: 2020, vin: car.vin }) })));
});

it('explains locked vehicle data and disables booking when no eligible vehicle exists', async () => {
  fetchMock.mockImplementation(async (url: string) => response(url === '/api/vehicles' ? [{ ...car, canEdit: false, canReserve: false }] : [slot]));
  render(<CustomerDashboard token="token" />);
  expect(await screen.findByText('Podatki so zaklenjeni, ker ima vozilo že rezervacijo.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Popravi podatke' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Potrdi rezervacijo' })).toBeDisabled();
});

it('shows empty lists and does not permit an incomplete reservation', async () => {
  fetchMock.mockResolvedValue(response([])); render(<CustomerDashboard token="token" />);
  expect(await screen.findByText('Trenutno ni prostih prihodnjih terminov.')).toBeInTheDocument();
  expect(screen.getByText(/Še nimate vnesenega vozila/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Potrdi rezervacijo' })).toBeDisabled();
});

it('books selected vehicle/slot, displays confirmation and refreshes availability', async () => {
  const user = userEvent.setup(); let booked = false;
  fetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/appointments') { booked = true; return response({ id: 'booking-1', registrationNumber: car.registrationNumber, startsAt: slot.startsAt, endsAt: slot.endsAt, status: 'BOOKED' }, 201); }
    return response(url === '/api/vehicles' ? [{ ...car, canEdit: !booked, canReserve: !booked }] : booked ? [] : [slot]);
  });
  render(<CustomerDashboard token="token" />);
  await screen.findByText('Renault Clio');
  await user.selectOptions(screen.getByLabelText('Vozilo za pregled'), car.id);
  await user.selectOptions(screen.getByLabelText('Prosti termin'), slot.id);
  await user.click(screen.getByRole('button', { name: 'Potrdi rezervacijo' }));
  expect(await screen.findByText('Rezervacija je potrjena.')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/appointments', expect.objectContaining({ method: 'POST', body: JSON.stringify({ vehicleId: car.id, slotId: slot.id }) }));
  expect(await screen.findByText('Trenutno ni prostih prihodnjih terminov.')).toBeInTheDocument();
});

it('shows a booking conflict and refreshes the available choices', async () => {
  const user = userEvent.setup(); let conflict = false;
  fetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/appointments') { conflict = true; return response({ error: 'Termin ni več prost.' }, 409); }
    return response(url === '/api/vehicles' ? [car] : conflict ? [] : [slot]);
  });
  render(<CustomerDashboard token="token" />); await screen.findByText('Renault Clio');
  await user.selectOptions(screen.getByLabelText('Vozilo za pregled'), car.id); await user.selectOptions(screen.getByLabelText('Prosti termin'), slot.id);
  await user.click(screen.getByRole('button', { name: 'Potrdi rezervacijo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Termin ni več prost');
  expect(await screen.findByText('Trenutno ni prostih prihodnjih terminov.')).toBeInTheDocument();
  expect(screen.queryByText('Rezervacija je potrjena.')).not.toBeInTheDocument();
});

it('admin sees read-only vehicles and can submit a station-time slot', async () => {
  const user = userEvent.setup();
  fetchMock.mockImplementation(async (url: string, options: { method?: string }) => response(options.method === 'POST' ? slot : url === '/api/vehicles' ? [car] : [slot], options.method === 'POST' ? 201 : 200));
  render(<AdminDashboard token="token" />); await screen.findByText('Renault Clio');
  expect(screen.queryByRole('button', { name: 'Popravi podatke' })).not.toBeInTheDocument();
  // datetime-local is edited directly because browser widgets vary by locale.
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.change(screen.getByLabelText('Začetek termina'), { target: { value: '2030-06-15T10:00' } });
  await user.click(screen.getByRole('button', { name: 'Objavi termin' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Termin je objavljen');
  expect(fetchMock).toHaveBeenCalledWith('/api/slots', expect.objectContaining({ method: 'POST', body: JSON.stringify({ startsAt: '2030-06-15T08:00:00Z' }) }));
});

it('interprets station time independently of browser time zone and rejects DST ambiguity/gaps', async () => {
  expect(await stationInstant('2030-01-15T10:00')).toBe('2030-01-15T09:00:00Z');
  expect(await stationInstant('2030-06-15T10:00')).toBe('2030-06-15T08:00:00Z');
  await expect(stationInstant('2026-03-29T02:30')).rejects.toThrow('izberite uro');
  await expect(stationInstant('2026-10-25T02:30')).rejects.toThrow('izberite uro');
});
