import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { dateTime, time } from './domain';
import type { Inspection } from './InspectorDashboard';

type Item = Inspection['items'][number];
const message = (e: unknown) => e instanceof ApiError ? e.message : 'Shranjevanje ni uspelo. Podatki ostajajo v obrazcu; poskusite ponovno.';
const payload = (data: Inspection) => ({ notes: data.notes ?? '', items: data.items.map(item => ({ id: item.id, result: item.result, notes: item.notes ?? '', defects: (item.defects ?? []).map(d => ({ description: d.description, severity: d.severity })) })) });
export function InspectionEditor({ id, token, onBack, onDirty }: { id: string; token: string; onBack: () => void; onDirty: (dirty: boolean) => void }) {
  const [data, setData] = useState<Inspection | null>(null);
  const [saved, setSaved] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0); const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const dirty = Boolean(data && data.status === 'IN_PROGRESS' && JSON.stringify(payload(data)) !== saved);
  useEffect(() => { onDirty(dirty || busy); }, [dirty, busy, onDirty]);
  useEffect(() => {
    if (data) return; // Token refresh must not replace an open draft.
    const controller = new AbortController(); setError('');
    void api<Inspection>(`/inspections/${id}`, token, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setData(value); setSaved(JSON.stringify(payload(value))); } })
      .catch(e => { if (!controller.signal.aborted) setError(message(e)); });
    return () => controller.abort();
  }, [id, token, retry, data]);
  const unassessed = data?.items.filter(item => item.result === 'NOT_CHECKED') ?? [];
  const invalid = data?.items.filter(item => item.result === 'FAIL' && (!(item.defects?.length) || item.defects.some(d => !d.description.trim()))) ?? [];
  const canComplete = Boolean(data?.items.length && !unassessed.length && !invalid.length);
  function changeItem(id: string, change: Partial<Item>) {
    setNotice(''); setError(''); setData(previous => previous ? { ...previous, items: previous.items.map(item => item.id === id ? { ...item, ...change } : item) } : previous);
  }
  function choose(item: Item, result: Item['result']) {
    if (result === item.result) return;
    if (result === 'PASS' && item.defects?.some(d => d.description.trim()) && !window.confirm('Označite kot v redu in odstranite napake te postavke?')) return;
    changeItem(item.id, { result, defects: result === 'FAIL' ? item.defects?.length ? item.defects : [{ id: crypto.randomUUID(), description: '', severity: 'MINOR' }] : [] });
  }
  async function save(complete: boolean) {
    if (!data || saving.current || (complete && !canComplete) || invalid.length) return;
    if (complete && !window.confirm('Shranite in zaključite pregled? Po zaključku podatkov ni več mogoče spreminjati.')) return;
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const updated = await api<Inspection>(`/inspections/${id}/checklist`, token, { method: 'PUT', body: payload(data) });
      setData(updated); setSaved(JSON.stringify(payload(updated)));
      if (complete) {
        const result = await api<{ status: 'COMPLETED'; completedAt: string; finalResult: string }>(`/inspections/${id}/complete`, token, { method: 'POST' });
        setData({ ...updated, ...result });
      } else setNotice('Vse spremembe so shranjene.');
    } catch (e) { setError(message(e)); }
    finally { saving.current = false; setBusy(false); }
  }
  const readOnly = data?.status === 'COMPLETED';
  return <section className="dashboard">
    <button className="secondary" disabled={busy} onClick={onBack}>Nazaj na razpored</button>
    {!data ? error ? <><p role="alert" className="alert error">{error}</p><button onClick={() => setRetry(v => v + 1)}>Poskusi ponovno</button></> : <p role="status">Nalaganje pregleda …</p> : <>
      <h2>Pregled · {data.registrationNumber}</h2><p>{data.manufacturer} {data.model} · VIN {data.vin}</p>
      <p className="muted">Termin: {dateTime(data.startsAt)}–{time(data.endsAt)} · Začetek pregleda: {dateTime(data.startedAt)}</p>
      {readOnly ? <p className="alert success">Zaključen pregled · {data.finalResult} · {data.completedAt && dateTime(data.completedAt)}. Podatki so samo za branje.</p> : <>
        <p>Za vsako postavko izberite oceno. Pri »Ni v redu« opišite napako in izberite resnost.</p>
        <p className="muted">30 minut je dolžina rezerviranega termina. Pregled lahko zaključite takoj, ko so vse postavke ocenjene.</p>
        <div className="checklist-progress" aria-live="polite"><strong>Ocenjeno {data.items.length - unassessed.length} od {data.items.length}</strong>
          {unassessed.length > 0 && <p>Še ocenite: {unassessed.map(i => i.category).join(', ')}.</p>}
          {invalid.length > 0 && <p>Dopišite opis napake: {invalid.map(i => i.category).join(', ')}.</p>}
          {canComplete && <p>Vse postavke so pripravljene za zaključek.</p>}
        </div>
      </>}
      <fieldset className="inspection-fields" disabled={busy || readOnly}>
        <div className="checklist">{data.items.map((item, index) => <section key={item.id} className={`checklist-row result-${item.result.toLowerCase()}`} aria-label={item.category}>
          <div className="checklist-line"><div><h3><span className="checklist-number">{index + 1}</span>{item.category}</h3><p className="muted">{item.name}</p></div>
            <div className="checklist-choices" role="radiogroup" aria-label={`Ocena · ${item.category}`}>
              <label><input type="radio" name={`result-${item.id}`} checked={item.result === 'PASS'} onChange={() => choose(item, 'PASS')} />V redu</label>
              <label><input type="radio" name={`result-${item.id}`} checked={item.result === 'FAIL'} onChange={() => choose(item, 'FAIL')} />Ni v redu</label>
            </div>
          </div>
          {item.result === 'FAIL' && <div className="checklist-defects">{(item.defects ?? []).map((defect, di) => <div className="checklist-defect" key={defect.id}>
            <div className="field"><label htmlFor={`description-${defect.id}`}>Opis napake · {item.category}{di ? ` (${di + 1})` : ''}</label><textarea id={`description-${defect.id}`} maxLength={2000} value={defect.description} placeholder="Kaj ni v redu?" onChange={e => changeItem(item.id, { defects: item.defects!.map((d, n) => n === di ? { ...d, description: e.target.value } : d) })} /></div>
            <div className="field"><label htmlFor={`severity-${defect.id}`}>Resnost · {item.category}{di ? ` (${di + 1})` : ''}</label><select id={`severity-${defect.id}`} value={defect.severity} onChange={e => changeItem(item.id, { defects: item.defects!.map((d, n) => n === di ? { ...d, severity: e.target.value as 'MINOR' | 'MAJOR' } : d) })}><option value="MINOR">Minor – manjša napaka</option><option value="MAJOR">Major – večja napaka</option></select></div>
            {!readOnly && (item.defects?.length ?? 0) > 1 && <button className="text-button" onClick={() => changeItem(item.id, { defects: item.defects!.filter((_, n) => n !== di) })}>Odstrani napako {di + 1}</button>}
          </div>)}{!readOnly && <button className="text-button" onClick={() => changeItem(item.id, { defects: [...(item.defects ?? []), { id: crypto.randomUUID(), description: '', severity: 'MINOR' }] })}>Dodaj še eno napako</button>}</div>}
          {item.notes && <p className="muted">Prejšnja opomba: {item.notes}</p>}
        </section>)}</div>
        <div className="field inspection-notes"><label htmlFor="inspection-notes">Splošna opomba pregleda (neobvezno)</label><textarea id="inspection-notes" maxLength={2000} value={data.notes ?? ''} onChange={e => { setNotice(''); setData({ ...data, notes: e.target.value }); }} /></div>
      </fieldset>
      {error && <p role="alert" className="alert error">{error}</p>}{notice && <p role="status" className="alert success">{notice}</p>}
      {!readOnly && <div className="inspection-savebar"><span className="muted">{busy ? 'Shranjevanje …' : dirty ? 'Spremembe še niso shranjene.' : 'Spremembe so shranjene.'}</span><div className="actions">
        <button className="secondary" disabled={busy || !dirty || invalid.length > 0} onClick={() => void save(false)}>Shrani pregled</button>
        <button className="primary" disabled={busy || !canComplete} onClick={() => void save(true)}>Shrani in zaključi</button>
      </div></div>}
    </>}
  </section>;
}
