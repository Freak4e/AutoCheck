import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi, afterEach } from 'vitest';
import { MyAppointments } from './MyAppointments';
const booking = { id: 'a1', registrationNumber: 'MB123', manufacturer: 'Renault', model: 'Clio', startsAt: '2026-11-08T08:00:00Z', endsAt: '2026-11-08T08:30:00Z', status: 'BOOKED', delayed: true };
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
afterEach(() => vi.unstubAllGlobals());
it('shows overdue BOOKED and refreshes to IN_PROGRESS then an empty list after completion', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response([booking])).mockResolvedValueOnce(response([{ ...booking, status: 'IN_PROGRESS', delayed: false }])).mockResolvedValueOnce(response([]));
  vi.stubGlobal('fetch', fetch); const refresh = vi.fn(); const user = userEvent.setup();
  const view = render(<MyAppointments token="token" revision={0} onRefresh={refresh} />);
  expect(await screen.findByText('Termin se še ni začel; možna je zamuda')).toBeInTheDocument();
  expect(screen.getByText('MB123 · Renault Clio')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Osveži rezervacije' })); expect(refresh).toHaveBeenCalledOnce();
  view.rerender(<MyAppointments token="token" revision={1} onRefresh={refresh} />);
  expect(await screen.findByText('IN_PROGRESS')).toBeInTheDocument(); expect(screen.queryByText(/možna je zamuda/)).not.toBeInTheDocument();
  view.rerender(<MyAppointments token="token" revision={2} onRefresh={refresh} />);
  expect(await screen.findByRole('link', { name: 'Rezervirajte nov termin' })).toHaveAttribute('href', '#booking-title');
});
it('shows load errors and allows retry instead of presenting an empty list', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'Storitev ni dosegljiva.' }, 503)));
  render(<MyAppointments token="token" revision={0} onRefresh={vi.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Storitev ni dosegljiva.');
  expect(screen.getByRole('button', { name: 'Osveži rezervacije' })).toBeEnabled();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('ignores an outdated response after the session changes', async () => {
  let resolve!: (value: unknown) => void;
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue(response([])));
  const view = render(<MyAppointments token="old" revision={0} onRefresh={vi.fn()} />);
  view.rerender(<MyAppointments token="new" revision={0} onRefresh={vi.fn()} />);
  await screen.findByRole('link'); await act(async () => resolve(response([booking])));
  expect(screen.queryByText('MB123 · Renault Clio')).not.toBeInTheDocument();
});
