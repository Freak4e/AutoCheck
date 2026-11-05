import { useState, type FormEvent } from 'react';
import { api, ApiError } from './api';
import type { Vehicle } from './domain';

export function VehicleForm({ token, vehicle, onSaved, onCancel }: { token: string; vehicle?: Vehicle; onSaved: () => void; onCancel: () => void }) {
  const [values, setValues] = useState({ registrationNumber: vehicle?.registrationNumber ?? '', manufacturer: vehicle?.manufacturer ?? '', model: vehicle?.model ?? '', year: String(vehicle?.year ?? ''), vin: vehicle?.vin ?? '' });
  const [error, setError] = useState('');
  const [field, setField] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setError(''); setField(undefined); setBusy(true);
    try {
      await api(`/vehicles${vehicle ? '/' + vehicle.id : ''}`, token, { method: vehicle ? 'PATCH' : 'POST', body: { ...values, year: Number(values.year) } });
      onSaved();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Vozila ni mogoče shraniti. Preverite povezavo in poskusite ponovno.');
      if (failure instanceof ApiError) setField(failure.field);
    } finally { setBusy(false); }
  }
  const inputs = [
    { key: 'registrationNumber', label: 'Registrska oznaka', max: 40 },
    { key: 'manufacturer', label: 'Proizvajalec', max: 60 },
    { key: 'model', label: 'Model', max: 60 },
    { key: 'year', label: 'Letnik', max: undefined },
    { key: 'vin', label: 'VIN', max: 17 },
  ] as const;
  return <section className="panel editor" aria-labelledby="vehicle-form-title">
    <h2 id="vehicle-form-title">{vehicle ? 'Popravi podatke vozila' : 'Dodaj vozilo'}</h2>
    <p className="muted">VIN ima 17 znakov, brez črk I, O in Q. Podatke lahko popravite do prve rezervacije.</p>
    <form onSubmit={save}>
      <div className="form-grid">{inputs.map(input => <div className="field" key={input.key}>
        <label htmlFor={`vehicle-${input.key}`}>{input.label}</label>
        <input id={`vehicle-${input.key}`} required disabled={busy} maxLength={input.max} type={input.key === 'year' ? 'number' : 'text'}
          min={input.key === 'year' ? 1900 : undefined} max={input.key === 'year' ? new Date().getFullYear() + 1 : undefined} step={input.key === 'year' ? 1 : undefined}
          value={values[input.key]} onChange={e => setValues({ ...values, [input.key]: e.target.value })}
          aria-invalid={field === input.key} aria-describedby={field === input.key ? 'vehicle-error' : undefined} />
      </div>)}</div>
      {error && <p role="alert" id="vehicle-error" className="alert error">{error}</p>}
      <div className="actions"><button className="primary" disabled={busy}>{busy ? 'Shranjevanje …' : 'Shrani vozilo'}</button><button type="button" className="secondary" disabled={busy} onClick={onCancel}>Prekliči</button></div>
    </form>
  </section>;
}
