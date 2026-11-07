import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { dateTime, type Vehicle } from './domain';
import type { Defect } from './DefectsEditor';
type Summary = { id: string; startedAt: string; completedAt: string; finalResult: string };
type Detail = Summary & { registrationNumber: string; manufacturer: string; model: string; vin: string; year: number; inspectorName: string; status: string; notes: string | null;
  items: { id: string; category: string; name: string; result: string; notes: string | null; defects: Defect[] }[] };
const failureText = (e: unknown) => e instanceof ApiError ? e.message : 'Zgodovine ni mogoče naložiti. Poskusite ponovno.';
export function VehicleHistory({ vehicles, token }: { vehicles: Vehicle[]; token: string }) {
  const [vehicleId, setVehicleId] = useState(''); const [history, setHistory] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  const [detailId, setDetailId] = useState(''); const [detail, setDetail] = useState<Detail | null>(null); const [detailError, setDetailError] = useState('');
  useEffect(() => {
    setDetailId(''); setDetail(null); setHistory([]); setError('');
    if (!vehicleId) { setLoading(false); return; }
    const controller = new AbortController(); setLoading(true);
    void api<Summary[]>(`/vehicles/${vehicleId}/inspections`, token, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setHistory(value); })
      .catch(e => { if (!controller.signal.aborted) setError(failureText(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [vehicleId, token, revision]);
  useEffect(() => {
    setDetail(null); setDetailError(''); if (!detailId) return;
    const controller = new AbortController();
    void api<Detail>(`/inspections/${detailId}`, token, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setDetail(value); })
      .catch(e => { if (!controller.signal.aborted) setDetailError(failureText(e)); });
    return () => controller.abort();
  }, [detailId, token]);
  return <section className="panel booking-panel" aria-label="Zgodovina vozila"><h2>Zgodovina pregledov</h2>
    <div className="field"><label htmlFor="history-vehicle">Vozilo za zgodovino</label><select id="history-vehicle" value={vehicleId} onChange={e => { setVehicleId(e.target.value); setDetailId(''); setDetail(null); setHistory([]); }}><option value="">Izberite vozilo</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.registrationNumber} · {v.manufacturer} {v.model}</option>)}</select></div>
    <button className="secondary" disabled={!vehicleId || loading} onClick={() => setRevision(v => v + 1)}>Osveži zgodovino</button>
    {error && <p role="alert" className="alert error">{error}</p>}
    {loading ? <p role="status">Nalaganje zgodovine …</p> : vehicleId && !error && (history.length ? <ul className="slot-list">{history.map(entry => <li key={entry.id}><button className="text-button" onClick={() => setDetailId(entry.id)}>{dateTime(entry.completedAt)} · {entry.finalResult}</button></li>)}</ul> : <p>Vozilo še nima zaključenih pregledov.</p>)}
    {detailError && <p role="alert" className="alert error">{detailError}</p>}
    {detailId && !detail && !detailError && <p role="status">Nalaganje ugotovitev …</p>}
    {detail && <article aria-label="Ugotovitve pregleda"><h3>{detail.registrationNumber} · {detail.manufacturer} {detail.model}</h3><p>Letnik {detail.year} · VIN {detail.vin}</p>
      <p>Preglednik: {detail.inspectorName}</p><p>Začetek: {dateTime(detail.startedAt)} · Zaključek: {dateTime(detail.completedAt)}</p>
      <p><strong>{detail.finalResult}</strong> · {detail.status}</p>{detail.notes && <p>{detail.notes}</p>}
      {detail.finalResult === 'REINSPECTION_REQUIRED' && <p className="locked">Nov termin ni samodejno rezerviran. Po potrebi ga rezervirajte prek običajnega obrazca za rezervacijo.</p>}
      {detail.items.every(item => item.defects.length === 0) && <p>Napake niso bile ugotovljene.</p>}
      {detail.items.map(item => <section key={item.id}><h4>{item.category} · {item.result}</h4><p>{item.name}</p>{item.notes && <p>{item.notes}</p>}
        {item.defects.map(defect => <p key={defect.id}>{defect.description} <span className="badge">{defect.severity}</span></p>)}
      </section>)}
    </article>}
  </section>;
}
