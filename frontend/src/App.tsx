import { useEffect, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { AuthForm } from './AuthForm';
import { api, ApiError, type Profile, type Role } from './api';
import { supabase } from './supabase';
import { CustomerDashboard } from './CustomerDashboard';
import { AdminDashboard } from './AdminDashboard';
import { InspectorDashboard } from './InspectorDashboard';

const areas: Record<Role, { api: string; path: string; title: string; label: string; next: string }> = {
  CUSTOMER: { api: 'customer', path: '/vozila', title: 'Moja vozila', label: 'Stranka', next: 'Vnos in seznam vaših vozil sta naslednji korak razvoja.' },
  INSPECTOR: { api: 'inspector', path: '/razpored', title: 'Razpored pregledov', label: 'Preglednik', next: 'Razpored, prevzem in izvajanje pregledov so načrtovani v naslednjih nalogah.' },
  ADMIN: { api: 'admin', path: '/evidence', title: 'Evidence postaje', label: 'Administrator', next: 'Bralni pregled evidenc in objava terminov sta načrtovana v naslednjih nalogah.' },
};

function SignedApp({ client }: { client: SupabaseClient }) {
  const [session, setSession] = useState<Session | null | undefined>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [path, setPath] = useState(window.location.pathname);
  const [inspectionDirty, setInspectionDirty] = useState(false);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    let active = true;
    let eventReceived = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      // Keep this callback synchronous: Supabase holds an Auth lock here.
      eventReceived = true;
      if (!active) return;
      setProfile(previous => previous?.id === nextSession?.user.id ? previous : null);
      setError(''); setSession(nextSession);
    });
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || eventReceived) return;
      setSession(data.session);
      if (sessionError) setError('Seje ni mogoče obnoviti. Prijavite se ponovno.');
    }).catch(() => {
      if (active && !eventReceived) { setSession(null); setError('Seje ni mogoče obnoviti. Poskusite ponovno.'); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [client]);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    // A routine token refresh must not unmount an editor with unsaved notes.
    setProfile(previous => previous?.id === session.user.id ? previous : null); setError('');
    async function load() {
      try {
        const current = await api<Profile>('/auth/profile', session!.access_token, {
          method: 'POST', body: { name: session!.user.user_metadata.name }, signal: controller.signal,
        });
        const area = areas[current.role];
        if (!area) throw new Error('Uporabniška vloga ni podprta.');
        const requested = Object.values(areas).find(item => item.path === path) ?? area;
        await api(`/workspace/${requested.api}`, session!.access_token, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setProfile(current);
        if (path !== requested.path) {
          window.history.replaceState(null, '', requested.path);
          setPath(requested.path);
        }
      } catch (failure) {
        if (controller.signal.aborted) return;
        if (failure instanceof ApiError && failure.status === 401) {
          await client.auth.signOut({ scope: 'local' });
          if (controller.signal.aborted) return;
          setSession(null);
        }
        setError(failure instanceof Error && !(failure instanceof TypeError) ? failure.message : 'Strežnik ni dosegljiv. Preverite zagon backenda in poskusite ponovno.');
      }
    }
    void load();
    return () => controller.abort();
  }, [session, retry, path, client]);

  async function signOut() {
    if (inspectionDirty && !window.confirm('Imate neshranjene spremembe pregleda. Se želite vseeno odjaviti?')) return;
    setSigningOut(true); setError('');
    try {
      const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
      if (signOutError) { setError('Odjava ni uspela. Poskusite ponovno.'); return; }
      setProfile(null); setSession(null);
      window.history.replaceState(null, '', '/prijava'); setPath('/prijava');
    } catch { setError('Odjava ni uspela. Preverite povezavo in poskusite ponovno.'); }
    finally { setSigningOut(false); }
  }

  if (session === undefined) return <p role="status" className="loading">Obnavljanje seje …</p>;
  if (!session) return <div className="auth-layout">
    <Intro />
    <div>{error && <p role="alert" className="alert error">{error}</p>}<AuthForm client={client} /></div>
  </div>;

  return <main className="workspace">
    <div className="workspace-top"><span className="eyebrow">UPORABNIŠKI PROSTOR</span><button className="secondary" onClick={signOut} disabled={signingOut}>{signingOut ? 'Odjava …' : 'Odjava'}</button></div>
    {error ? <section className="panel"><p role="alert" className="alert error">{error}</p>
      <button className="secondary" onClick={() => setRetry(value => value + 1)}>Poskusi ponovno</button>{' '}
      <button className="text-button" onClick={() => { window.history.replaceState(null, '', '/'); setPath('/'); }}>Moja začetna stran</button>
    </section> : !profile ? <p role="status">Nalaganje profila …</p> : <>
      <h1>{areas[profile.role].title}</h1>
      <p className="welcome">Pozdravljeni, <strong>{profile.name}</strong>. <span className="badge">{areas[profile.role].label}</span></p>
      {profile.role === 'CUSTOMER' ? <CustomerDashboard token={session.access_token} /> : profile.role === 'ADMIN' ? <AdminDashboard token={session.access_token} /> : <InspectorDashboard token={session.access_token} onDirtyChange={setInspectionDirty} />}
    </>}
  </main>;
}

function Intro() {
  return <section className="intro"><p className="eyebrow">TEHNIČNI PREGLEDI · ENA POSTAJA</p>
    <h1>Prvi korak do<br /><em>urejenega pregleda.</em></h1>
    <p>Ustvarite račun in dostopajte do svojega prostora v aplikaciji AutoCheck.</p>
    <div className="intro-note"><span className="status-dot" /><span>Vaša vozila in rezervacije na enem mestu</span></div>
    <div className="road" aria-hidden="true"><div className="road-line" /><span className="road-marker">A</span><span className="road-end">✓</span></div>
  </section>;
}

export function App() {
  return <><header className="site-header"><a className="brand" href="/" aria-label="AutoCheck – začetna stran"><span className="brand-mark" aria-hidden="true">A<span>✓</span></span>AutoCheck<span className="brand-dot">.</span></a><span className="header-note">Tehnični pregledi vozil</span></header>
    {supabase ? <SignedApp client={supabase} /> : <main className="workspace"><section className="panel"><p className="eyebrow">LOKALNA PRIPRAVA</p><h1>Nastavite povezavo s Supabase.</h1><p>V datoteko <code>frontend/.env</code> vnesite <code>VITE_SUPABASE_URL</code> in <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, nato ponovno zaženite frontend.</p><p>Celoten postopek za bazo, backend in uporabniške račune je opisan v <code>README.md</code>.</p></section></main>}
    <footer>AutoCheck <span>Študijski projekt · učna simulacija tehničnega pregleda</span></footer></>;
}
