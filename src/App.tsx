import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { currencies, isCurrencyCode, isLocale, locales, type CurrencyCode, type Locale } from './domain/currency';
import { copy } from './lib/i18n';

type Profile = { id: string; nickname: string; preferred_locale: Locale; preferred_currency_code: CurrencyCode };
type Workspace = { id: string; name: string; kind: 'personal' | 'team'; currency_code: CurrencyCode };

const localLocale = (): Locale => {
  const saved = window.localStorage.getItem('courier-ledger-locale');
  if (saved && isLocale(saved)) return saved;
  const browser = navigator.language.slice(0, 2);
  return isLocale(browser) ? browser : 'ru';
};

export default function App() {
  const [locale, setLocale] = useState<Locale>(localLocale);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('CZK');
  const [view, setView] = useState<'dashboard' | 'profile'>('dashboard');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const tr = copy[locale];

  useEffect(() => { document.documentElement.lang = locale; window.localStorage.setItem('courier-ledger-locale', locale); }, [locale]);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    void client.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setLoading(false); } });
    const { data: listener } = client.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setNotice(''); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!supabase || !session) { setProfile(null); setWorkspaces([]); return; }
    const client = supabase;
    let cancelled = false;
    void (async () => {
      const [p, w] = await Promise.all([
        client.from('profiles').select('id,nickname,preferred_locale,preferred_currency_code').eq('id', session.user.id).single(),
        client.from('workspaces').select('id,name,kind,currency_code').order('created_at', { ascending: true }),
      ]);
      if (cancelled) return;
      if (p.error) { setNotice(p.error.message); } else if (p.data) {
        const next = p.data as Profile;
        setProfile(next); setNickname(next.nickname); setSelectedCurrency(next.preferred_currency_code);
        if (isLocale(next.preferred_locale)) setLocale(next.preferred_locale);
      }
      if (w.error) setNotice(w.error.message); else setWorkspaces((w.data ?? []) as Workspace[]);
    })();
    return () => { cancelled = true; };
  }, [session]);

  async function authenticate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setNotice('');
    const result = tab === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { data: { nickname: nickname.trim() || email.split('@')[0], preferred_locale: locale, preferred_currency_code: selectedCurrency } } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setNotice(result.error.message);
    else if (tab === 'signup' && !result.data.session) setNotice(tr.confirm);
    setBusy(false);
  }
  async function googleSignIn() {
    if (!supabase) return;
    setBusy(true); setNotice('');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) { setNotice(error.message); setBusy(false); }
  }
  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !session || !profile) return;
    setBusy(true); setNotice('');
    const { data, error } = await supabase.from('profiles')
      .update({ nickname: nickname.trim(), preferred_locale: locale, preferred_currency_code: selectedCurrency })
      .eq('id', session.user.id)
      .select('id,nickname,preferred_locale,preferred_currency_code').single();
    if (error) setNotice(error.message);
    else { setProfile(data as Profile); setNotice(tr.success); }
    setBusy(false);
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="logo" href="/" onClick={e => e.preventDefault()} aria-label="Courier Ledger"><span className="logo-icon">↗</span><span>courier<span className="logo-highlight">ledger</span></span></a>
      <div className="top-right">
        <div className="locale-switch" aria-label={tr.language}>{locales.map(l => <button key={l} onClick={() => setLocale(l)} className={locale === l ? 'active' : ''}>{l.toUpperCase()}</button>)}</div>
        {session && <button className="text-btn" onClick={() => void supabase?.auth.signOut()}>{tr.logout} ↗</button>}
      </div>
    </header>
    {!supabase ? <main className="container centered">
      <div className="eyebrow">{tr.phase}</div><h1>{tr.setup}</h1><p className="muted max">{tr.setupText}</p>
      <code className="inline-code">VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY</code>
    </main> : loading ? <main className="container centered"><div className="spinner" /></main> : !session ? <main className="auth-layout container">
      <section className="auth-hero">
        <div className="eyebrow"><span className="online-dot" /> COURIER PROFIT TRACKING</div>
        <h1>{tr.intro}</h1><p className="hero-subtitle">{tr.subtitle}</p>
        <div className="hero-visual">
          <div className="visual-label">{tr.slogan}</div>
          <div className="visual-bars">{[34,52,41,76,62,94,81,100,78,92,70,98].map((v,i)=><span key={i} style={{height:`${v}%`}} />)}</div>
          <span className="visual-footer">✦ CZK &nbsp; ✦ EUR &nbsp; ✦ USD &nbsp; ✦ UAH</span>
        </div>
      </section>
      <section className="auth-card">
        <div className="auth-tabs"><button className={tab==='signin'?'active':''} onClick={()=>{setTab('signin');setNotice('')}}>{tr.login}</button><button className={tab==='signup'?'active':''} onClick={()=>{setTab('signup');setNotice('')}}>{tr.register}</button></div>
        <h2>{tab==='signin'?tr.login:tr.create}</h2>
        <button className="google-button" onClick={()=>void googleSignIn()} disabled={busy}><span className="google-g">G</span>{tr.google}</button>
        <div className="or-divider"><span>{tr.or}</span></div>
        <form onSubmit={e=>void authenticate(e)} className="field-stack">
          {tab === 'signup' && <label>{tr.nickname}<input value={nickname} onChange={e=>setNickname(e.target.value)} minLength={2} maxLength={40} placeholder="Courier" /></label>}
          <label>{tr.email}<input autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="hello@example.com" /></label>
          <label>{tr.password}<input autoComplete={tab==='signin'?'current-password':'new-password'} type="password" minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" /></label>
          {tab==='signup' && <label>{tr.currency}<select value={selectedCurrency} onChange={e=>{if(isCurrencyCode(e.target.value))setSelectedCurrency(e.target.value as CurrencyCode)}}>{currencies.map(c=><option key={c} value={c}>{c}</option>)}</select></label>}
          {notice && <div className="notice" role="status">{notice}</div>}
          <button className="primary-btn" type="submit" disabled={busy}>{busy?'…':tab==='signin'?tr.login:tr.create}<span>→</span></button>
        </form>
      </section>
    </main> : <main className="container dashboard-layout">
      <aside className="sidebar"><div className="sidebar-kicker">{tr.workspaceLabel}</div><button className={view==='dashboard'?'nav-active':''} onClick={()=>setView('dashboard')}>▦ &nbsp;{tr.welcome}</button><button className={view==='profile'?'nav-active':''} onClick={()=>{setView('profile');setNotice('')}}>⚙ &nbsp;{tr.account}</button><div className="sidebar-bottom">{tr.phase}</div></aside>
      <section className="dashboard-content">
        {view==='dashboard'?<>
          <div className="eyebrow"><span className="online-dot" /> {tr.phase}</div><h1>{tr.welcome}<span className="muted-title">, {profile?.nickname ?? session.user.email}</span></h1>
          <p className="muted">{tr.slogan}</p>
          <div className="section-title"><h2>{tr.workspace}</h2></div>
          <div className="workspace-grid">{workspaces.length ? workspaces.map(w=><div key={w.id} className="workspace-card"><div className="card-top"><span className="workspace-glyph">{w.kind==='personal'?'◉':'◎'}</span><span className="currency-chip">{w.currency_code}</span></div><h3>{w.kind==='personal'?tr.personal:w.name}</h3><p>{w.kind==='personal'?tr.account:tr.team}</p><div className="card-bottom">{tr.soon} <span>↗</span></div></div>) : <div className="workspace-card muted">{tr.empty}</div>}</div>
          <div className="next-section"><div className="eyebrow">{tr.coming}</div><h2>{tr.soon}</h2><p className="muted">{tr.planned}</p><div className="feature-chips"><span>{tr.shifts}</span><span>{tr.analytics}</span><span>{tr.expenses}</span></div></div>
        </>:<><div className="eyebrow">{tr.accountSettings}</div><h1>{tr.account}</h1><form onSubmit={e=>void saveProfile(e)} className="settings-card field-stack">
          <label>{tr.nickname}<input required minLength={2} maxLength={40} value={nickname} onChange={e=>setNickname(e.target.value)} /></label>
          <label>{tr.language}<select value={locale} onChange={e=>{if(isLocale(e.target.value))setLocale(e.target.value as Locale)}}>{locales.map(l=><option value={l} key={l}>{l.toUpperCase()}</option>)}</select></label>
          <label>{tr.currency}<select value={selectedCurrency} onChange={e=>{if(isCurrencyCode(e.target.value))setSelectedCurrency(e.target.value as CurrencyCode)}}>{currencies.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
          <div className="explain-note">ⓘ {tr.privacy}</div>
          {notice && <div className="notice" role="status">{notice}</div>}
          <button className="primary-btn" disabled={busy} type="submit">{tr.save} <span>→</span></button>
        </form></>}
      </section>
    </main>}
    <footer className="footer"><span>COURIER LEDGER / v0.1 Foundation</span><span>© 2026</span></footer>
  </div>;
}
