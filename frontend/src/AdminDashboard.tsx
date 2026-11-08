import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from './api';
import { type Slot, dateTime, time, stationInstant } from './domain';

import { AdminRecords } from './AdminRecords';

export function AdminDashboard({ token }: { token: string }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [start, setStart] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void api<Slot[]>('/slots', token, { signal: controller.signal })
      .then((nextSlots) => { if (!controller.signal.aborted) { setSlots(nextSlots); } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof ApiError ? failure.message : 'Podatkov ni mogoče naložiti. Poskusite ponovno.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, revision]);
  async function publish(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setFormError(''); setNotice(''); setBusy(true);
    try {
      const startsAt = await stationInstant(start);
      const result = await api<Slot>('/slots', token, { method: 'POST', body: { startsAt } });
      setNotice(`Termin je objavljen: ${dateTime(result.startsAt)}–${time(result.endsAt)}.`); setStart(''); setRevision(value => value + 1);
    } catch (failure) { setFormError(failure instanceof Error && !(failure instanceof TypeError) ? failure.message : 'Termina ni mogoče objaviti. Poskusite ponovno.'); }
    finally { setBusy(false); }
  }
  return <div className="dashboard">
    <section className="panel" aria-labelledby="slots-title"><p className="eyebrow">PONUDBA PREGLEDOV</p><h2 id="slots-title">Objava prostega termina</h2>
      <p className="muted">Termin traja 30 minut. Datum in ura sta v časovnem pasu Europe/Ljubljana. Objavljenih terminov v MVP ni mogoče spreminjati ali umakniti.</p>
      <form onSubmit={publish}><div className="field"><label htmlFor="slot-start">Začetek termina</label><input id="slot-start" type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} disabled={busy} /></div>
        {formError && <p role="alert" className="alert error">{formError}</p>}{notice && <p role="status" className="alert success">{notice}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Objavljanje …' : 'Objavi termin'}</button>
      </form>
    </section>
    <div className="section-heading"><h2>Objavljeni termini</h2><button className="secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}>Osveži termine</button></div>
    {error && <p role="alert" className="alert error">{error}</p>}
    {loading ? <p role="status">Nalaganje evidenc …</p> : !error && <>
      {slots.length ? <ul className="slot-list">{slots.map(slot => <li className="panel" key={slot.id}><span>{dateTime(slot.startsAt)}–{time(slot.endsAt)}</span><span className="badge">{slot.available ? 'Prost' : 'Ni na voljo'}</span></li>)}</ul> : <p className="panel">Ni objavljenih terminov.</p>}
    </>}
    <AdminRecords token={token} />
  </div>;
}
