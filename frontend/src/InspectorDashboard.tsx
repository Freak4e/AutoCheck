import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { dateTime, time } from './domain';
import { DefectsEditor, type Defect } from './DefectsEditor';

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

function InspectionEditor({ id, token, onBack, onDirty }: { id: string; token: string; onBack: () => void; onDirty: (dirty: boolean) => void }) {
  const [data, setData] = useState<Inspection | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [changed, setChanged] = useState<Record<string, boolean>>({});
  const [finishing, setFinishing] = useState(false); const [finishError, setFinishError] = useState('');
  async function finish() {
    if (finishing || Object.values(changed).some(Boolean)) return;
    if (!window.confirm('Zaključite pregled? Po zaključku podatkov ne bo več mogoče spreminjati.')) return;
    setFinishing(true); setFinishError('');
    try { const result = await api<{ status: 'COMPLETED'; finalResult: string; completedAt: string }>(`/inspections/${id}/complete`, token, { method: 'POST' }); setData(previous => previous ? { ...previous, ...result } : previous); setChanged({}); }
    catch (e) { setFinishError(message(e)); } finally { setFinishing(false); }
  }
  useEffect(() => { onDirty(Object.values(changed).some(Boolean)); }, [changed, onDirty]);
  function mark(key: string, dirty: boolean) { setChanged(previous => previous[key] === dirty ? previous : { ...previous, [key]: dirty }); }
  useEffect(() => {
    const controller = new AbortController(); setError('');
    void api<Inspection>(`/inspections/${id}`, token, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(message(failure)); });
    return () => controller.abort();
  }, [id, token, retry]);
  return <section className="dashboard">
    <button className="secondary" disabled={finishing} onClick={onBack}>Nazaj na razpored</button>
    {error ? <><p role="alert" className="alert error">{error}</p><button onClick={() => setRetry(value => value + 1)}>Poskusi ponovno</button></> : !data ? <p role="status">Nalaganje pregleda …</p> : <>
      <h2>Pregled · {data.registrationNumber}</h2><p>{data.manufacturer} {data.model} · VIN {data.vin}</p>
      <p className="muted">Termin: {dateTime(data.startsAt)}–{time(data.endsAt)} · Dejanski začetek: {dateTime(data.startedAt)}</p>
      {data.status === 'IN_PROGRESS' && Date.now() > Date.parse(data.endsAt) && <p className="locked">Pregled presega načrtovani konec termina.</p>}
      {data.status === 'COMPLETED' && <p className="alert success">Zaključen pregled · {data.finalResult} · {data.completedAt && dateTime(data.completedAt)}. Podatki so samo za branje.</p>}
      {Object.values(changed).some(Boolean) && <p role="status" className="locked">Imate neshranjene spremembe. Shranite vsako spremenjeno postavko oziroma opombo.</p>}
      <fieldset disabled={finishing} className="inspection-fields"><NotesEditor inspection={data} token={token} onDirty={dirty => mark('notes', dirty)} />
      {data.items.map(item => <ItemEditor key={item.id} item={item} inspectionId={id} token={token} readOnly={data.status !== 'IN_PROGRESS'} onDirty={dirty => mark(item.id, dirty)} />)}
      </fieldset>
      {finishError && <p role="alert" className="alert error">{finishError}</p>}
      {data.status === 'IN_PROGRESS' && <button className="primary" disabled={finishing || Object.values(changed).some(Boolean)} onClick={() => void finish()}>{finishing ? 'Zaključevanje …' : 'Zaključi pregled'}</button>}
    </>}
  </section>;
}

function NotesEditor({ inspection, token, onDirty }: { inspection: Inspection; token: string; onDirty: (dirty: boolean) => void }) {
  const [value, setValue] = useState(inspection.notes ?? '');
  const [saved, setSaved] = useState(value); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const dirty = value !== saved;
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  async function save() {
    setBusy(true); setError('');
    try { const result = await api<{ notes: string | null }>(`/inspections/${inspection.id}`, token, { method: 'PATCH', body: { notes: value } }); setValue(result.notes ?? ''); setSaved(result.notes ?? ''); }
    catch (failure) { setError(message(failure)); } finally { setBusy(false); }
  }
  return <section className="panel editor"><div className="field"><label htmlFor="inspection-notes">Splošna opomba pregleda</label><textarea id="inspection-notes" maxLength={2000} value={value} disabled={busy || inspection.status !== 'IN_PROGRESS'} onChange={e => setValue(e.target.value)} /></div>
    {error && <p role="alert" className="alert error">{error}</p>}
    {inspection.status === 'IN_PROGRESS' && <button className="secondary" disabled={!dirty || busy} onClick={() => void save()}>{busy ? 'Shranjevanje …' : 'Shrani opombo'}</button>}
  </section>;
}

function ItemEditor({ item, inspectionId, token, readOnly, onDirty }: { item: Item; inspectionId: string; token: string; readOnly: boolean; onDirty: (dirty: boolean) => void }) {
  const [result, setResult] = useState(item.result); const [notes, setNotes] = useState(item.notes ?? '');
  const [saved, setSaved] = useState({ result: item.result, notes: item.notes ?? '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const dirty = result !== saved.result || notes !== saved.notes;
  const [defectDirty, setDefectDirty] = useState(false);
  useEffect(() => { onDirty(dirty || busy || defectDirty); }, [dirty, busy, defectDirty, onDirty]);
  async function save() {
    setBusy(true); setError('');
    try {
      const data = await api<Item>(`/inspections/${inspectionId}/items/${item.id}`, token, { method: 'PATCH', body: { result, notes } });
      const next = { result: data.result, notes: data.notes ?? '' }; setResult(next.result); setNotes(next.notes); setSaved(next);
    } catch (failure) { setError(message(failure)); } finally { setBusy(false); }
  }
  return <section className="panel editor" aria-label={item.category}><h3>{item.category}</h3><p>{item.name}</p>
    <div className="form-grid"><div className="field"><label htmlFor={`result-${item.id}`}>Ocena · {item.category}</label><select id={`result-${item.id}`} value={result} disabled={readOnly || busy} onChange={e => setResult(e.target.value as Item['result'])}>
      <option value="NOT_CHECKED">Ni preverjeno</option><option value="PASS">Ustrezno</option><option value="FAIL">Neustrezno</option>
    </select></div><div className="field"><label htmlFor={`notes-${item.id}`}>Opomba · {item.category}</label><textarea id={`notes-${item.id}`} maxLength={2000} disabled={readOnly || busy} value={notes} onChange={e => setNotes(e.target.value)} /></div></div>
    {error && <p role="alert" className="alert error">{error}</p>}
    {!readOnly && <button className="secondary" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Shranjevanje …' : 'Shrani postavko'}</button>}
    <DefectsEditor initial={item.defects ?? []} token={token} inspectionId={inspectionId} itemId={item.id} result={result} canAdd={!dirty && saved.result === 'FAIL'} readOnly={readOnly} onDirty={setDefectDirty} />
  </section>;
}
