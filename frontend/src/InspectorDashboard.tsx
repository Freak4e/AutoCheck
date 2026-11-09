import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { dateTime, time } from './domain';
import type { Defect } from './DefectsEditor';
import { InspectionEditor } from './InspectionEditor';

export type ScheduleRow = {
  id: string; status: 'BOOKED' | 'IN_PROGRESS' | 'COMPLETED'; startsAt: string; endsAt: string;
  registrationNumber: string; manufacturer: string; model: string; year: number; vin: string;
  inspectionId: string | null; isMine: boolean; canStart: boolean; stationBusy: boolean; overdue: boolean;
};
type Item = { id: string; category: string; name: string; result: 'PASS' | 'FAIL' | 'NOT_CHECKED'; notes: string | null; defects?: Defect[] };
export type Inspection = Omit<ScheduleRow, 'inspectionId' | 'isMine' | 'canStart' | 'stationBusy' | 'overdue'> & {
  startedAt: string; completedAt: string | null; finalResult: string | null; notes: string | null; items: Item[];
};
const message = (failure: unknown) => failure instanceof ApiError ? failure.message : 'Storitev ni dosegljiva. Poskusite ponovno.';
const labels = { BOOKED: 'Rezerviran', IN_PROGRESS: 'V teku', COMPLETED: 'Zaključen' };

export function InspectorDashboard({ token, onDirtyChange }: { token: string; onDirtyChange?: (dirty: boolean) => void }) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (selected) return;
    const controller = new AbortController(); setLoading(true); setError('');
    void api<ScheduleRow[]>('/appointments', token, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setRows(data); })
      .catch(failure => { if (!controller.signal.aborted) setError(message(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, revision, selected]);
  async function start(id: string) {
    if (busy) return; setBusy(id); setError('');
    try {
      const result = await api<{ id: string }>(`/appointments/${id}/start`, token, { method: 'POST' });
      setSelected(result.id);
    } catch (failure) {
      // Refresh availability after a competing claim, but retain its explanation.
      try { setRows(await api<ScheduleRow[]>('/appointments', token)); } catch { /* Keep the original error. */ }
      setError(message(failure));
    } finally { setBusy(null); }
  }
  if (selected) return <InspectionEditor key={selected} id={selected} token={token} onDirty={setDirty} onBack={() => {
    if (dirty && !window.confirm('Imate neshranjene spremembe. Zapustite pregled brez shranjevanja?')) return;
    setDirty(false); setSelected(null);
  }} />;
  return <section className="dashboard" aria-label="Rezervacije postaje">
    <div className="section-heading"><h2>Naročena vozila</h2><button className="secondary" disabled={loading || Boolean(busy)} onClick={() => setRevision(value => value + 1)}>Osveži razpored</button></div>
    <p className="muted">Časi so prikazani v Europe/Ljubljana. Na postaji lahko poteka en pregled hkrati.</p>
    {error && <p role="alert" className="alert error">{error}</p>}
    {loading ? <p role="status">Nalaganje razporeda …</p> : rows.length === 0 && !error ? <p className="panel">Ni rezervacij.</p> : <div className="vehicle-grid">{rows.map(row => <article className="panel" key={row.id}>
      <p className="registration">{row.registrationNumber}</p><h3>{row.manufacturer} {row.model}</h3>
      <p>{dateTime(row.startsAt)}–{time(row.endsAt)} <span className="badge">{labels[row.status]}</span></p>
      <p className="muted">Letnik {row.year} · VIN {row.vin}</p>
      {row.overdue && <p className="locked">Pregled presega načrtovani konec termina.</p>}
      {row.status === 'BOOKED' && <><button className="primary" disabled={!row.canStart || Boolean(busy)} onClick={() => void start(row.id)}>{busy === row.id ? 'Prevzemanje …' : 'Začni pregled'}</button>
        {!row.canStart && <p className="muted">{row.stationBusy ? 'Začetek ni mogoč: pregledno mesto je zasedeno.' : 'Prevzem bo mogoč ob začetku termina.'}</p>}</>}
      {row.inspectionId && row.isMine && <button className="secondary" disabled={Boolean(busy)} onClick={() => setSelected(row.inspectionId)}>{row.status === 'IN_PROGRESS' ? 'Nadaljuj pregled' : 'Odpri zaključen pregled'}</button>}
      {row.status === 'IN_PROGRESS' && !row.isMine && <p className="muted">Pregled je prevzel drug preglednik.</p>}
    </article>)}</div>}
  </section>;
}
