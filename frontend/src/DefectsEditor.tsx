import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
export type Defect = { id: string; description: string; severity: 'MINOR' | 'MAJOR' };
const errorText = (e: unknown) => e instanceof ApiError ? e.message : 'Napake ni mogoče shraniti. Poskusite ponovno.';
export function DefectsEditor({ initial, token, inspectionId, itemId, result, canAdd, readOnly, onDirty }: {
  initial: Defect[]; token: string; inspectionId: string; itemId: string; result: string; canAdd: boolean; readOnly: boolean; onDirty: (dirty: boolean) => void;
}) {
  const [defects, setDefects] = useState(initial); const [draft, setDraft] = useState(''); const [severity, setSeverity] = useState<'MINOR' | 'MAJOR'>('MINOR');
  const [changes, setChanges] = useState<Record<string, boolean>>({}); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const dirty = Boolean(draft) || busy || Object.values(changes).some(Boolean);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  async function add() {
    setBusy(true); setError('');
    try { const value = await api<Defect>(`/inspections/${inspectionId}/items/${itemId}/defects`, token, { method: 'POST', body: { description: draft, severity } }); setDefects(previous => [...previous, value]); setDraft(''); setSeverity('MINOR'); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <div className="defects"><h4>Napake</h4>
    {!defects.length && <p className="muted">Ni zabeleženih napak.</p>}
    {!readOnly && ((result === 'FAIL' && !defects.length) || (result === 'PASS' && defects.length > 0)) && <p className="locked">Neskladje: FAIL zahteva vsaj eno napako, PASS mora biti brez napak. Pred zaključkom popravite podatke.</p>}
    {defects.map(defect => <DefectEntry key={defect.id} defect={defect} token={token} inspectionId={inspectionId} readOnly={readOnly || busy}
      onDirty={value => setChanges(previous => previous[defect.id] === value ? previous : { ...previous, [defect.id]: value })}
      onChange={value => { setDefects(previous => value ? previous.map(d => d.id === value.id ? value : d) : previous.filter(d => d.id !== defect.id)); setChanges(previous => ({ ...previous, [defect.id]: false })); }} />)}
    {!readOnly && <><div className="field"><label htmlFor={`new-defect-${itemId}`}>Opis nove napake</label><textarea id={`new-defect-${itemId}`} maxLength={2000} value={draft} disabled={busy} onChange={e => setDraft(e.target.value)} /></div>
      <div className="field"><label htmlFor={`new-severity-${itemId}`}>Resnost nove napake</label><select id={`new-severity-${itemId}`} value={severity} disabled={busy} onChange={e => setSeverity(e.target.value as Defect['severity'])}><option value="MINOR">Manjša (MINOR)</option><option value="MAJOR">Večja (MAJOR)</option></select></div>
      {!canAdd && <p className="muted">Za dodajanje napake najprej shranite oceno Neustrezno (FAIL).</p>}
      <button className="secondary" disabled={busy || !canAdd || !draft.trim()} onClick={() => void add()}>Dodaj napako</button></>}
    {error && <p role="alert" className="alert error">{error}</p>}
  </div>;
}
function DefectEntry({ defect, token, inspectionId, readOnly, onChange, onDirty }: { defect: Defect; token: string; inspectionId: string; readOnly: boolean; onChange: (defect: Defect | null) => void; onDirty: (dirty: boolean) => void }) {
  const [description, setDescription] = useState(defect.description); const [severity, setSeverity] = useState(defect.severity); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const dirty = busy || description !== defect.description || severity !== defect.severity;
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  async function save(remove = false) {
    setBusy(true); setError('');
    try { const value = await api<Defect>(`/inspections/${inspectionId}/defects/${defect.id}`, token, { method: remove ? 'DELETE' : 'PATCH', ...(remove ? {} : { body: { description, severity } }) }); if (!remove) { setDescription(value.description); setSeverity(value.severity); } onChange(remove ? null : value); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  if (readOnly) return <p>{defect.description} <span className="badge">{defect.severity}</span></p>;
  return <div className="panel"><div className="field"><label htmlFor={`defect-${defect.id}`}>Opis napake</label><textarea id={`defect-${defect.id}`} maxLength={2000} value={description} disabled={busy} onChange={e => setDescription(e.target.value)} /></div>
    <div className="field"><label htmlFor={`severity-${defect.id}`}>Resnost napake</label><select id={`severity-${defect.id}`} value={severity} disabled={busy} onChange={e => setSeverity(e.target.value as Defect['severity'])}><option value="MINOR">Manjša (MINOR)</option><option value="MAJOR">Večja (MAJOR)</option></select></div>
    <div className="actions"><button className="secondary" disabled={busy || !dirty || !description.trim()} onClick={() => void save()}>Shrani napako</button><button className="secondary" disabled={busy} onClick={() => void save(true)}>Odstrani napako</button></div>
    {error && <p role="alert" className="alert error">{error}</p>}
  </div>;
}
