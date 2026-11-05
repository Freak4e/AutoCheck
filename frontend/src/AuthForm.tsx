import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

function authMessage(error: { code?: string; message: string }) {
  const messages: Record<string, string> = {
    invalid_credentials: 'E-pošta ali geslo nista pravilna.',
    email_not_confirmed: 'Pred prijavo potrdite e-poštni naslov prek prejete povezave.',
    user_already_exists: 'Račun s tem naslovom že obstaja. Nadaljujte s prijavo.',
    email_exists: 'Račun s tem naslovom že obstaja. Nadaljujte s prijavo.',
    weak_password: 'Geslo ne ustreza pravilom prijave. ' + error.message,
    over_email_send_rate_limit: 'Preveč zahtev za e-pošto. Počakajte in poskusite ponovno.',
    over_request_rate_limit: 'Preveč poskusov. Počakajte in poskusite ponovno.',
    signup_disabled: 'Registracija je trenutno onemogočena.',
  };
  return messages[error.code ?? ''] ?? 'Postopek ni uspel. Preverite povezavo in poskusite ponovno.';
}

export function AuthForm({ client }: { client: SupabaseClient }) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const invalid: Record<string, string> = {};
    if (register && (!name.trim() || name.trim().length > 100)) invalid.name = 'Vnesite ime (največ 100 znakov).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) invalid.email = 'Vnesite veljaven e-poštni naslov.';
    if (!password) invalid.password = 'Vnesite geslo.';
    setFields(invalid); setError(''); setNotice('');
    if (Object.keys(invalid).length) return;
    setBusy(true);
    try {
      if (register) {
        const { data, error: authError } = await client.auth.signUp({
          email: email.trim(), password,
          options: { data: { name: name.trim() }, emailRedirectTo: window.location.origin },
        });
        if (authError) { setError(authMessage(authError)); return; }
        setPassword('');
        if (!data.session) {
          setNotice('Preverite e-pošto za potrditev računa, nato se prijavite. Če račun že obstaja, nadaljujte s prijavo.');
          setRegister(false);
        }
      } else {
        const { error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) setError(authMessage(authError));
      }
    } catch { setError('Prijavna storitev ni dosegljiva. Preverite povezavo in poskusite ponovno.'); }
    finally { setBusy(false); }
  }

  return <section className="auth-card" aria-labelledby="auth-title">
    <p className="eyebrow">VAŠ RAČUN</p>
    <h2 id="auth-title">{register ? 'Ustvarite račun' : 'Dobrodošli nazaj'}</h2>
    <p className="muted">{register ? 'Registrirajte se kot stranka postaje AutoCheck.' : 'Za nadaljevanje se prijavite v AutoCheck.'}</p>
    <form noValidate onSubmit={submit}>
      {register && <div className="field">
        <label htmlFor="name">Ime in priimek</label>
        <input id="name" autoComplete="name" maxLength={100} value={name} disabled={busy} onChange={e => setName(e.target.value)} aria-invalid={Boolean(fields.name)} aria-describedby={fields.name ? 'name-error' : undefined} />
        {fields.name && <span id="name-error" className="field-error">{fields.name}</span>}
      </div>}
      <div className="field">
        <label htmlFor="email">E-poštni naslov</label>
        <input id="email" type="email" autoComplete="email" value={email} disabled={busy} onChange={e => setEmail(e.target.value)} aria-invalid={Boolean(fields.email)} aria-describedby={fields.email ? 'email-error' : undefined} />
        {fields.email && <span id="email-error" className="field-error">{fields.email}</span>}
      </div>
      <div className="field">
        <label htmlFor="password">Geslo</label>
        <input id="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} value={password} disabled={busy} onChange={e => setPassword(e.target.value)} aria-invalid={Boolean(fields.password)} aria-describedby={fields.password ? 'password-error' : undefined} />
        {fields.password && <span id="password-error" className="field-error">{fields.password}</span>}
      </div>
      {error && <p role="alert" className="alert error">{error}</p>}
      {notice && <p role="status" className="alert success">{notice}</p>}
      <button className="primary full" disabled={busy}>{busy ? 'Počakajte …' : register ? 'Ustvari račun' : 'Prijava'}</button>
    </form>
    <p className="switch-mode">{register ? 'Že imate račun?' : 'Še nimate računa?'}{' '}
      <button type="button" className="text-button" disabled={busy} onClick={() => { setRegister(!register); setError(''); setNotice(''); setFields({}); setPassword(''); }}>
        {register ? 'Prijavite se' : 'Ustvarite račun'}
      </button>
    </p>
  </section>;
}
