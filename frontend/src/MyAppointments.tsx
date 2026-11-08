import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { dateTime, time } from './domain';

type Appointment = { id: string; registrationNumber: string; manufacturer: string; model: string; startsAt: string; endsAt: string; status: 'BOOKED' | 'IN_PROGRESS'; delayed: boolean };

export function MyAppointments({ token, revision, onRefresh }: { token: string; revision: number; onRefresh: () => void }) {
  const [rows, setRows] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setRows([]);
    void api<Appointment[]>('/appointments', token, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setRows(data); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof ApiError ? failure.message : 'Rezervacij ni mogoče naložiti. Poskusite znova.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, revision]);
  return <section className="panel" aria-labelledby="my-appointments-title">
    <div className="section-heading"><h2 id="my-appointments-title">Moje odprte rezervacije</h2><button className="secondary" disabled={loading} onClick={onRefresh}>Osveži rezervacije</button></div>
    <p className="muted">Termini so prikazani v časovnem pasu Europe/Ljubljana. Zaključene preglede najdete v zgodovini vozila.</p>
    {loading ? <p role="status">Nalaganje rezervacij …</p> : error ? <p role="alert" className="alert error">{error}</p> : rows.length ? rows.map(row => <article key={row.id} className="panel">
      <h3>{row.registrationNumber} · {row.manufacturer} {row.model}</h3>
      <p>{dateTime(row.startsAt)}–{time(row.endsAt)}</p>
      <p><strong>{row.status}</strong> · {row.status === 'BOOKED' ? 'Rezervirano' : 'Pregled poteka'}</p>
      {row.delayed && row.status === 'BOOKED' && <p className="alert">Termin se še ni začel; možna je zamuda</p>}
    </article>) : <p>Nimate odprtih rezervacij. <a href="#booking-title">Rezervirajte nov termin</a>.</p>}
  </section>;
}
