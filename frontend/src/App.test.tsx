import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { auth } }));
import { App } from './App';

const session = { access_token: 'test-token', user: { id: 'test-user', user_metadata: { name: 'Ana' } } } as unknown as Session;
let change: (event: string, session: Session | null) => void;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, '', '/');
  auth.getSession.mockResolvedValue({ data: { session }, error: null });
  auth.onAuthStateChange.mockImplementation(callback => {
    change = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  auth.signOut.mockImplementation(async () => { change('SIGNED_OUT', null); return { error: null }; });
  fetchMock = vi.fn().mockImplementation(async (path: string) => ({ ok: true, json: async () => ['/api/vehicles', '/api/slots'].includes(path) ? [] : ({ id: 'test-user', name: 'Ana', role: 'CUSTOMER' }) }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); });

it('sends restored session to the backend and opens the customer starting page', async () => {
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Moja vozila' })).toBeInTheDocument();
  expect(screen.getByText('Stranka')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/profile', expect.objectContaining({
    method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer test-token' }), body: JSON.stringify({ name: 'Ana' }),
  }));
  expect(window.location.pathname).toBe('/vozila');
});

it.each([['INSPECTOR', 'Razpored pregledov', '/razpored'], ['ADMIN', 'Evidence postaje', '/evidence']])('uses persisted %s role for the starting page', async (role, title, path) => {
  fetchMock.mockImplementation(async (path: string) => ({ ok: true, json: async () => ['/api/vehicles', '/api/slots', '/api/appointments'].includes(path) ? [] : ({ id: 'test-user', name: 'Osebje', role }) }));
  render(<App />);
  expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  expect(window.location.pathname).toBe(path);
});

it('shows login for a protected URL without a session and never fetches protected data', async () => {
  window.history.replaceState(null, '', '/evidence');
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Dobrodošli nazaj' })).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('does not open a workspace rejected by the server', async () => {
  window.history.replaceState(null, '', '/evidence');
  fetchMock.mockImplementation(async (path: string) => path.includes('/workspace/')
    ? { ok: false, status: 403, json: async () => ({ error: 'Vaša vloga ne dovoljuje tega dejanja.' }) }
    : { ok: true, json: async () => ({ id: 'test-user', name: 'Ana', role: 'CUSTOMER' }) });
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Vaša vloga ne dovoljuje');
  expect(screen.queryByRole('heading', { name: 'Evidence postaje' })).not.toBeInTheDocument();
});

it('signs out and removes the protected page', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: 'Moja vozila' });
  await user.click(screen.getByRole('button', { name: 'Odjava' }));
  expect(await screen.findByRole('heading', { name: 'Dobrodošli nazaj' })).toBeInTheDocument();
  expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(screen.queryByText('Stranka')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/prijava');
});

it('ignores an old profile response that arrives after sign-out', async () => {
  let resolve!: (value: unknown) => void;
  fetchMock.mockImplementation(() => new Promise(done => { resolve = done; }));
  render(<App />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  act(() => change('SIGNED_OUT', null));
  await act(async () => { resolve({ ok: true, json: async () => ({ id: 'test-user', name: 'Ana', role: 'ADMIN' }) }); });
  expect(screen.getByRole('heading', { name: 'Dobrodošli nazaj' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Evidence postaje' })).not.toBeInTheDocument();
});

it('keeps unsaved inspection notes through a token refresh of the same user', async () => {
  fetchMock.mockImplementation(async (path: string) => ({ ok: true, json: async () => {
    if (path === '/api/appointments') return [{ id: 'a1', status: 'IN_PROGRESS', startsAt: '2020-01-01T10:00:00Z', endsAt: '2020-01-01T10:30:00Z', registrationNumber: 'MB123', isMine: true, inspectionId: 'i1' }];
    if (path === '/api/inspections/i1') return { id: 'i1', status: 'IN_PROGRESS', registrationNumber: 'MB123', startsAt: '2020-01-01T10:00:00Z', endsAt: '2020-01-01T10:30:00Z', startedAt: '2020-01-01T10:01:00Z', notes: null, items: [] };
    return { id: 'test-user', name: 'Preglednik', role: 'INSPECTOR' };
  } }));
  const user = userEvent.setup(); render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Nadaljuj pregled' }));
  await user.type(await screen.findByLabelText('Splošna opomba pregleda'), 'Neshranjena opomba');
  act(() => change('TOKEN_REFRESHED', { ...session, access_token: 'new-token' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/profile', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer new-token' }) })));
  expect(screen.getByLabelText('Splošna opomba pregleda')).toHaveValue('Neshranjena opomba');
});
