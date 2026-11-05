import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthForm } from './AuthForm';

function setup() {
  const signUp = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
  const signInWithPassword = vi.fn().mockResolvedValue({ data: {}, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
  const client = { auth: { signUp, signInWithPassword } } as unknown as SupabaseClient;
  render(<AuthForm client={client} />);
  return { signUp, signInWithPassword, user: userEvent.setup() };
}

describe('US-01 / US-02 authentication form', () => {
  it('identifies required registration fields without contacting Auth', async () => {
    const { user, signUp } = setup();
    await user.click(screen.getByRole('button', { name: 'Ustvarite račun' }));
    await user.click(screen.getByRole('button', { name: 'Ustvari račun' }));
    expect(screen.getByText('Vnesite ime (največ 100 znakov).')).toBeInTheDocument();
    expect(screen.getByText('Vnesite veljaven e-poštni naslov.')).toBeInTheDocument();
    expect(screen.getByText('Vnesite geslo.')).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('rejects whitespace name and invalid email', async () => {
    const { user, signUp } = setup();
    await user.click(screen.getByRole('button', { name: 'Ustvarite račun' }));
    await user.type(screen.getByLabelText('Ime in priimek'), '   ');
    await user.type(screen.getByLabelText('E-poštni naslov'), 'invalid');
    await user.type(screen.getByLabelText('Geslo'), 'example-password');
    await user.click(screen.getByRole('button', { name: 'Ustvari račun' }));
    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByLabelText('E-poštni naslov')).toHaveAttribute('aria-invalid', 'true');
  });

  it('registers only name/email/password and explains confirmation or existing account', async () => {
    const { user, signUp } = setup();
    await user.click(screen.getByRole('button', { name: 'Ustvarite račun' }));
    await user.type(screen.getByLabelText('Ime in priimek'), ' Ana Novak ');
    await user.type(screen.getByLabelText('E-poštni naslov'), 'ana@example.com');
    await user.type(screen.getByLabelText('Geslo'), 'example-password');
    await user.click(screen.getByRole('button', { name: 'Ustvari račun' }));
    expect(signUp).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'example-password', options: { data: { name: 'Ana Novak' }, emailRedirectTo: window.location.origin } });
    expect(screen.getByRole('status')).toHaveTextContent('Če račun že obstaja');
    expect(screen.getByRole('button', { name: 'Prijava' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Geslo')).toHaveValue('');
  });

  it('shows wrong credentials and keeps the login form', async () => {
    const { user, signInWithPassword } = setup();
    await user.type(screen.getByLabelText('E-poštni naslov'), 'ana@example.com');
    await user.type(screen.getByLabelText('Geslo'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Prijava' }));
    expect(signInWithPassword).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent('E-pošta ali geslo nista pravilna');
  });

  it('shows network errors and permits retry', async () => {
    const { user, signInWithPassword } = setup();
    signInWithPassword.mockRejectedValue(new TypeError('Failed to fetch'));
    await user.type(screen.getByLabelText('E-poštni naslov'), 'ana@example.com');
    await user.type(screen.getByLabelText('Geslo'), 'example-password');
    await user.click(screen.getByRole('button', { name: 'Prijava' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Prijavna storitev ni dosegljiva');
    expect(screen.getByRole('button', { name: 'Prijava' })).toBeEnabled();
  });
});
