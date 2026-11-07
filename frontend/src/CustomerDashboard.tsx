import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { type Vehicle, type Slot, type Booking, dateTime, time } from './domain';
import { VehicleForm } from './VehicleForm';
import { VehicleHistory } from './VehicleHistory';

export function CustomerDashboard({ token }: { token: string }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null);
  const [vehicleId, setVehicleId] = useState('');
  const [slotId, setSlotId] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingError, setBookingError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void Promise.all([api<Vehicle[]>('/vehicles', token, { signal: controller.signal }), api<Slot[]>('/slots', token, { signal: controller.signal })])
      .then(([nextVehicles, nextSlots]) => {
        if (controller.signal.aborted) return;
        setVehicles(nextVehicles); setSlots(nextSlots);
        setVehicleId(id => nextVehicles.some(v => v.id === id && v.canReserve) ? id : '');
        setSlotId(id => nextSlots.some(s => s.id === id) ? id : '');
      }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof ApiError ? failure.message : 'Podatkov ni mogoče naložiti. Preverite povezavo.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, revision]);

  async function reserve() {
    if (busy || !vehicleId || !slotId) return;
    setBusy(true); setBookingError(''); setBooking(null);
    try {
      const result = await api<Booking>('/appointments', token, { method: 'POST', body: { vehicleId, slotId } });
      setBooking(result); setVehicleId(''); setSlotId(''); setRevision(value => value + 1);
    } catch (failure) {
      setBookingError(failure instanceof ApiError ? failure.message : 'Rezervacije ni mogoče potrditi. Preverite povezavo in osvežite podatke pred ponovitvijo.');
      setRevision(value => value + 1);
    } finally { setBusy(false); }
  }

  return <div className="dashboard">
    <div className="section-heading"><h2>Vozila</h2><div className="actions"><button className="secondary" onClick={() => setRevision(value => value + 1)} disabled={loading || busy}>Osveži</button><button className="primary" onClick={() => setEditing('new')} disabled={busy}>Dodaj vozilo</button></div></div>
    {editing && <VehicleForm key={editing === 'new' ? 'new' : editing.id} token={token} vehicle={editing === 'new' ? undefined : editing} onSaved={() => { setEditing(null); setRevision(value => value + 1); }} onCancel={() => setEditing(null)} />}
    {error && <p role="alert" className="alert error">{error}</p>}
    {loading ? <p role="status">Nalaganje vozil in terminov …</p> : !error && (vehicles.length ? <div className="vehicle-grid">{vehicles.map(vehicle => <article className="panel vehicle-card" key={vehicle.id}>
      <p className="registration">{vehicle.registrationNumber}</p><h3>{vehicle.manufacturer} {vehicle.model}</h3>
      <p className="muted">Letnik {vehicle.year}<br /><span className="vin">VIN {vehicle.vin}</span></p>
      {vehicle.canEdit ? <button className="secondary" disabled={busy} onClick={() => setEditing(vehicle)}>Popravi podatke</button> : <p className="locked">Podatki so zaklenjeni, ker ima vozilo že rezervacijo.</p>}
      {!vehicle.canReserve && <p className="muted">Vozilo ima odprto rezervacijo.</p>}
    </article>)}</div> : <p className="panel">Še nimate vnesenega vozila. Izberite »Dodaj vozilo«, da ga boste lahko naročili na pregled.</p>)}

    <section className="panel booking-panel" aria-labelledby="booking-title"><p className="eyebrow">NOV TEHNIČNI PREGLED</p><h2 id="booking-title">Rezervirajte termin</h2>
      <p className="muted">Termini trajajo 30 minut. Prikaz je v časovnem pasu Europe/Ljubljana.</p>
      {booking && <div role="status" className="alert success"><strong>Rezervacija je potrjena.</strong><br />{booking.registrationNumber} · {dateTime(booking.startsAt)}–{time(booking.endsAt)} · BOOKED</div>}
      {bookingError && <p role="alert" className="alert error">{bookingError}</p>}
      {!loading && !vehicles.some(v => v.canReserve) && <p>Za rezervacijo dodajte vozilo brez odprte rezervacije.</p>}
      {!loading && slots.length === 0 && <p>Trenutno ni prostih prihodnjih terminov.</p>}
      <div className="form-grid">
        <div className="field"><label htmlFor="booking-vehicle">Vozilo za pregled</label><select id="booking-vehicle" value={vehicleId} onChange={e => setVehicleId(e.target.value)} disabled={loading || busy || Boolean(error)}><option value="">Izberite vozilo</option>{vehicles.filter(v => v.canReserve).map(v => <option key={v.id} value={v.id}>{v.registrationNumber} · {v.manufacturer} {v.model}</option>)}</select></div>
        <div className="field"><label htmlFor="booking-slot">Prosti termin</label><select id="booking-slot" value={slotId} onChange={e => setSlotId(e.target.value)} disabled={loading || busy || Boolean(error)}><option value="">Izberite termin</option>{slots.map(s => <option key={s.id} value={s.id}>{dateTime(s.startsAt)}–{time(s.endsAt)}</option>)}</select></div>
      </div>
      <button className="primary" disabled={!vehicleId || !slotId || busy || loading || Boolean(error)} onClick={reserve}>{busy ? 'Potrjevanje …' : 'Potrdi rezervacijo'}</button>
    </section>
    <VehicleHistory vehicles={vehicles} token={token} />
  </div>;
}
