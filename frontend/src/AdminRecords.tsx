import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { dateTime, time, type Vehicle } from './domain';
import type { Defect } from './DefectsEditor';

type Appointment = { id: string; vehicleId: string; registrationNumber: string; status: string; startsAt: string; endsAt: string; inspectionId: string | null };
type Inspection = { id: string; vehicleId: string; registrationNumber: string; status: string; startedAt: string; finalResult: string | null };
type Detail = Inspection & { manufacturer: string; model: string; vin: string; year: number; inspectorName: string; completedAt: string | null; notes: string | null;
  items: { id: string; category: string; name: string; result: string; notes: string | null; defects: Defect[] }[] };
const message = (error: unknown) => error instanceof ApiError ? error.message : 'Evidenc ni mogoče naložiti. Poskusite ponovno.';

export function AdminRecords({ token }: { token: string }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [detailId, setDetailId] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState(''); const [detailError, setDetailError] = useState('');
  const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setDetailId(''); setDetail(null);
    void Promise.all([api<Vehicle[]>('/vehicles', token, { signal: controller.signal }), api<Appointment[]>('/appointments', token, { signal: controller.signal }), api<Inspection[]>('/inspections', token, { signal: controller.signal })])
      .then(([v, a, i]) => { if (!controller.signal.aborted) { setVehicles(v); setAppointments(a); setInspections(i); setVehicleId(current => v.some(row => row.id === current) ? current : ''); } })
      .catch(e => { if (!controller.signal.aborted) setError(message(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, revision]);
  useEffect(() => {
    setDetail(null); setDetailError(''); if (!detailId) return;
    const controller = new AbortController();
    void api<Detail>(`/inspections/${detailId}`, token, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setDetail(value); })
      .catch(e => { if (!controller.signal.aborted) setDetailError(message(e)); });
    return () => controller.abort();
  }, [detailId, token, revision]);
  const selected = vehicles.find(v => v.id === vehicleId);
  const bookings = appointments.filter(a => !vehicleId || a.vehicleId === vehicleId);
  const reviews = inspections.filter(i => !vehicleId || i.vehicleId === vehicleId);
  return <section className="panel" aria-label="Evidence postaje">
    <div className="section-heading"><h2>Evidence postaje</h2><button className="secondary" onClick={() => setRevision(v => v + 1)} disabled={loading}>Osveži evidence</button></div>
    <p className="muted">Bralni vpogled v vozila, rezervacije in preglede vseh strank. Časovni pas: Europe/Ljubljana.</p>
    {loading ? <p role="status">Nalaganje evidenc …</p> : error ? <p role="alert" className="alert error">{error}</p> : <>
      <h3>Vozila postaje</h3>
      <div className="field"><label htmlFor="records-vehicle">Filter vozila</label><select id="records-vehicle" value={vehicleId} onChange={e => { setVehicleId(e.target.value); setDetailId(''); }}><option value="">Vsa vozila</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.registrationNumber} · {v.manufacturer} {v.model}</option>)}</select></div>
      {vehicles.length ? <div className="vehicle-grid">{(selected ? [selected] : vehicles).map(v => <article className="panel" key={v.id}><h4>{v.registrationNumber} · {v.manufacturer} {v.model}</h4><p>Letnik {v.year} · VIN {v.vin}</p><button className="text-button" onClick={() => { setVehicleId(v.id); setDetailId(''); }}>Rezervacije in pregledi vozila {v.registrationNumber}</button></article>)}</div> : <p>Ni vnesenih vozil.</p>}
      <h3>Rezervacije</h3>
      {bookings.length ? <ul className="slot-list">{bookings.map(a => <li className="panel" key={a.id}><p>{a.registrationNumber} · {dateTime(a.startsAt)}–{time(a.endsAt)} · {a.status}</p><button className="text-button" onClick={() => { setVehicleId(a.vehicleId); setDetailId(''); }}>Podatki vozila {a.registrationNumber}</button>{a.inspectionId ? <button className="secondary" onClick={() => setDetailId(a.inspectionId!)}>Odpri pregled rezervacije {a.registrationNumber}</button> : <p>Pregled še ni začet</p>}</li>)}</ul> : <p>Ni rezervacij.</p>}
      <h3>Pregledi</h3>
      {reviews.length ? <ul className="slot-list">{reviews.map(i => <li key={i.id}><button className="text-button" onClick={() => setDetailId(i.id)}>{i.registrationNumber} · {dateTime(i.startedAt)} · {i.finalResult ?? 'Pregled poteka'}</button></li>)}</ul> : <p>Ni pregledov.</p>}
      {detailError && <p role="alert" className="alert error">{detailError}</p>}
      {detailId && !detail && !detailError && <p role="status">Nalaganje ugotovitev …</p>}
      {detail && <article aria-label="Podrobnosti pregleda"><h3>{detail.registrationNumber} · {detail.manufacturer} {detail.model}</h3><p>Letnik {detail.year} · VIN {detail.vin}</p><p>Preglednik: {detail.inspectorName}</p><p>Začetek: {dateTime(detail.startedAt)}</p><p>Stanje: {detail.status}</p>
        {detail.completedAt ? <p>Zaključek: {dateTime(detail.completedAt)} · <strong>{detail.finalResult}</strong></p> : <p>Pregled poteka; končni izid še ni določen.</p>}
        {detail.notes && <p>{detail.notes}</p>}
        {detail.items.map(item => <section key={item.id}><h4>{item.category} · {item.result}</h4><p>{item.name}</p>{item.notes && <p>{item.notes}</p>}{item.defects.length ? item.defects.map(d => <p key={d.id}>{d.description} <span className="badge">{d.severity}</span></p>) : <p>Ni zabeleženih napak.</p>}</section>)}
      </article>}
    </>}
  </section>;
}
