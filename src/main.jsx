import { CENTRAL_ALERTS, saveTone, toneFor, TONES, toneUrl } from './lib/tones.js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, supabaseConfigured } from './lib/supabase.js';
import {
  assignService,
  billingReport,
  cancelService,
  companyEarnings,
  createUser,
  listBranches,
  listCouriers,
  listProfiles,
  listRates,
  listServices,
  payrollReport,
  SERVICE_LABELS,
  reassignService,
  sendAssignmentPush,
  sendRemovedPush,
  setBranchActive,
  setProfileActive,
  STATUS_LABELS,
  subscribeToOperations,
  updateProfile,
  updateService,
  updateRate
} from './lib/operations.js';
import { Icon } from './components/Icon.jsx';
import { DispatchPage } from './components/Dispatch.jsx';
import { AuthScreen } from './components/AuthScreen.jsx';
import { usernameToAuthEmail } from './lib/auth.js';
import './styles.css';
import './central-design.css';
import './central-tweaks.css';

// Sube cada vez que algo cambia en la base; las pantallas de reportes recargan con él.
const LiveContext = createContext(0);
const LIVE_LABELS = { live: 'En vivo', reconnecting: 'Reconectando', offline: 'Sin conexión' };

function LiveStatus({ status }) {
  return <span className={'central-live-pill central-live-pill--' + status}><span className="live-dot live-dot--green" aria-hidden="true" />{LIVE_LABELS[status]}</span>;
}

function LoadingScreen() { return <main className="loading-screen"><div className="loading-mark">911</div><strong>Abriendo la central</strong><span>Conectando con la operación segura.</span></main>; }

function SetupScreen({ onSignOut, role, missing, message }) { return <main className="setup-screen"><div className="setup-card"><div className="setup-icon">!</div><p>Acceso de central</p><h1>{missing ? 'Falta completar tu perfil.' : 'Esta cuenta no puede operar la central.'}</h1><span>{message || (missing ? 'La administración debe asignar un perfil de operador.' : `El rol recibido es ${role || 'sin asignar'}.`)}</span><button className="button button--secondary" type="button" onClick={onSignOut}>Cerrar sesión</button></div></main>; }

function App() {
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [activeSection, setActiveSection] = useState('dispatch');
  const [services, setServices] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [rates, setRates] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [alertService, setAlertService] = useState(null);
  const [liveRevision, setLiveRevision] = useState(0);
  const [liveStatus, setLiveStatus] = useState('reconnecting');
  const [soundReady, setSoundReady] = useState(() => navigator.userActivation?.hasBeenActive ?? false);
  const knownServices = useRef(null);
  const [now, setNow] = useState(() => Date.now());

  const playSound = useCallback(key => {
    new Audio(toneUrl(toneFor(key))).play().catch(() => setSoundReady(false));
  }, []);

  useEffect(() => {
    if (!supabase) { setSessionLoading(false); return undefined; }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setSessionLoading(false); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); if (!next) setProfile(null); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const signIn = useCallback(async (username, password) => {
    if (!supabase) return { error: new Error('Supabase no está configurado.') };
    const email = usernameToAuthEmail(username);
    return supabase.auth.signInWithPassword({ email, password });
  }, []);

  const signOut = useCallback(async () => { if (supabase) await supabase.auth.signOut(); }, []);

  const refreshData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const baseRequests = [listServices(), listCouriers(), listRates(), listBranches()];
    const adminRequests = profile?.role === 'admin' ? [listProfiles()] : [];
    const results = await Promise.all([...baseRequests, ...adminRequests]);
    const [serviceResult, courierResult, rateResult, branchResult, profileResult] = results;
    if (!serviceResult.error && !courierResult.error) setError('');
    if (serviceResult.error) setError(serviceResult.error.message || 'No se pudo cargar la cola.'); else {
      // La primera carga solo memoriza; desde ahí, un servicio sin asignar que no se conocía es nuevo.
      const rows = serviceResult.data || [];
      if (knownServices.current) {
        const fresh = rows.filter(item => item.status === 'unassigned' && !knownServices.current.has(item.id)).at(-1);
        const delivered = rows.some(item => item.status === 'delivered' && knownServices.current.has(item.id) && knownServices.current.get(item.id) !== 'delivered');
        if (fresh) {
          setAlertService(fresh);
          playSound('new');
        } else if (delivered) playSound('delivered');
      }
      knownServices.current = new Map(rows.map(item => [item.id, item.status]));
      setServices(rows);
    }
    if (courierResult.error) setError(courierResult.error.message || 'No se pudieron cargar los domiciliarios.'); else setCouriers(courierResult.data || []);
    if (!rateResult.error) setRates(rateResult.data || []);
    if (!branchResult.error) setBranches(branchResult.data || []);
    if (profileResult && !profileResult.error) setProfiles(profileResult.data || []);
    setLoading(false);
  }, [profile?.role, playSound]);

  // A los 10 minutos sin asignar suena cada 30 segundos, en cualquier sección.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const urgentCount = services.filter(item => item.status === 'unassigned' && now - new Date(item.created_at).getTime() >= URGENT_MS).length;
  const hasUrgent = Boolean(profile) && urgentCount > 0;
  useEffect(() => {
    if (!hasUrgent) return undefined;
    playSound('urgent');
    const timer = setInterval(() => playSound('urgent'), 30000);
    return () => clearInterval(timer);
  }, [hasUrgent, playSound]);

  useEffect(() => {
    if (!session || !supabase) return undefined;
    let mounted = true;
    Promise.all([supabase.from('profiles').select('id, full_name, phone, role, active').eq('id', session.user.id).maybeSingle(), refreshData()]).then(([result]) => {
      if (!mounted) return;
      if (result.error) setProfileError(result.error.message);
      else if (!result.data) setProfileError('Tu cuenta todavía no tiene un perfil operativo.');
      else if (!result.data.active) setProfileError('Esta cuenta está desactivada. Comunícate con la administración.');
      else setProfile(result.data);
    });
    return () => { mounted = false; };
  }, [session, refreshData]);

  // El navegador solo deja sonar alertas después de la primera interacción.
  useEffect(() => {
    if (soundReady) return undefined;
    const unlock = () => setSoundReady(true);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [soundReady]);

  useEffect(() => {
    if (!session) return undefined;
    let timer = null;
    const sync = async () => {
      const own = await supabase.from('profiles').select('id, full_name, phone, role, active').eq('id', session.user.id).maybeSingle();
      if (!own.error && own.data) {
        setProfile(own.data);
        setProfileError(own.data.active ? '' : 'Esta cuenta está desactivada. Comunícate con la administración.');
      }
      await refreshData({ silent: true });
      setLiveRevision(value => value + 1);
    };
    // Varios cambios seguidos, como el GPS de los domiciliarios, se juntan en una recarga.
    const schedule = () => { clearTimeout(timer); timer = setTimeout(sync, 400); };
    const unsubscribe = subscribeToOperations(schedule, setLiveStatus);
    const onOffline = () => setLiveStatus('offline');
    window.addEventListener('offline', onOffline);
    const backup = setInterval(schedule, 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') schedule(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', schedule);
    return () => {
      clearTimeout(timer);
      clearInterval(backup);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', schedule);
      window.removeEventListener('offline', onOffline);
      unsubscribe();
    };
  }, [session, refreshData]);

  async function handleAssign(service, courierId) {
    const courier = couriers.find(item => item.id === courierId);
    const result = await assignService(service.id, courierId);
    if (result.error) { setToast({ type: 'error', message: result.error.message || 'No se pudo asignar el servicio.' }); return; }
    setServices(current => current.map(item => item.id === service.id ? result.data : item));
    const pushResult = await sendAssignmentPush(result.data.id);
    setToast({ type: 'success', message: pushResult.error
      ? `${service.code} fue asignado a ${courier?.full_name || 'el domiciliario'}. El aviso push quedó pendiente de configuración.`
      : `${service.code} fue asignado y se envió el aviso al domiciliario.` });
  }

  async function handleReassign(service, courierId, reason) {
    const courier = couriers.find(item => item.id === courierId);
    const result = await reassignService(service.id, courierId, reason);
    if (result.error) { setToast({ type: 'error', message: result.error.message || 'No se pudo reasignar el servicio.' }); return false; }
    setServices(current => current.map(item => item.id === service.id ? result.data : item));
    void sendAssignmentPush(result.data.id);
    void sendRemovedPush(result.data.id);
    setToast({ type: 'success', message: `${service.code} ahora es de ${courier?.full_name || 'el nuevo domiciliario'}.` });
    return true;
  }

  async function handleEdit(service, patch) {
    const result = await updateService(service, patch);
    if (result.error) { setToast({ type: 'error', message: result.error.message || 'No se pudieron guardar los cambios.' }); return false; }
    setServices(current => current.map(item => item.id === service.id ? result.data : item));
    setToast({ type: 'success', message: `${service.code} actualizado.` });
    return true;
  }

  async function handleCancel(service, reason) {
    const result = await cancelService(service.id, reason);
    if (result.error) { setToast({ type: 'error', message: result.error.message || 'No se pudo cancelar el servicio.' }); return; }
    setServices(current => current.map(item => item.id === service.id ? result.data : item));
    setToast({ type: 'success', message: `${service.code} quedó cancelado.` });
  }

  async function handleRateSave(rate, generalPrice, courierPrice, generalConfirmed, courierConfirmed) {
    const result = await updateRate(rate.id, generalPrice, courierPrice, generalConfirmed, courierConfirmed);
    if (result.error) { setToast({ type: 'error', message: result.error.message || 'No se pudo guardar la tarifa.' }); return; }
    setRates(current => current.map(item => item.id === rate.id ? result.data : item));
    setToast({ type: 'success', message: 'Tarifa actualizada.' });
  }

  if (sessionLoading) return <LoadingScreen />;
  if (!supabaseConfigured) return <AuthScreen configured={false} onSignIn={signIn} />;
  if (!session) return <AuthScreen configured onSignIn={signIn} />;
  if (profileError) return <SetupScreen onSignOut={signOut} missing={false} message={profileError} />;
  if (!profile) return <SetupScreen onSignOut={signOut} missing />;
  if (!['central', 'admin'].includes(profile.role)) return <SetupScreen onSignOut={signOut} role={profile.role} missing={false} />;

  return <LiveContext.Provider value={liveRevision}><CentralShell liveStatus={liveStatus} profile={profile} activeSection={activeSection} onSectionChange={setActiveSection} onSignOut={signOut} pendingCount={services.filter(item => item.status === 'unassigned').length} toast={toast} onDismissToast={() => setToast(null)}>
    {!soundReady && <button className="sound-banner" type="button" onClick={() => setSoundReady(true)}><Icon name="bell" size={16} />Toca aquí para activar el sonido de las alertas</button>}
    {urgentCount > 0 && <button className="urgent-banner" type="button" onClick={() => setActiveSection('dispatch')}><Icon name="bell" size={18} />{urgentCount === 1 ? '1 servicio lleva' : `${urgentCount} servicios llevan`} más de 10 minutos sin asignar. Priorizar ahora</button>}
    {alertService && activeSection !== 'dispatch' && <button className="central-alert central-alert--link" type="button" onClick={() => setActiveSection('dispatch')}><span className="central-alert-icon"><Icon name="bell" size={18} /></span><span className="central-alert-copy"><strong>Nuevo servicio de farmanorte {alertService.branch_code}</strong><span>{alertService.code} · Ir a Despacho</span></span></button>}
    {activeSection === 'dispatch' && <DispatchPage services={services} couriers={couriers} branches={branches} loading={loading} error={error} liveStatus={liveStatus} onRefresh={refreshData} onAssign={handleAssign} onReassign={handleReassign} onEdit={handleEdit} onCancel={handleCancel} alertService={alertService} onDismissAlert={() => setAlertService(null)} />} 
    {activeSection === 'sounds' && <SoundsPage />}
    {activeSection === 'earnings' && profile.role === 'admin' && <EarningsPage />}
    {activeSection === 'tariffs' && profile.role === 'admin' && <RatesPage rates={rates} onSave={handleRateSave} />}
    {activeSection === 'users' && profile.role === 'admin' && <UsersPage profiles={profiles} branches={branches} onRefresh={refreshData} onCreate={async values => {
      const result = await createUser(values);
      if (result.error) { setToast({ type: 'error', message: result.error.message || 'No se pudo crear el usuario.' }); return false; }
      await refreshData();
      setToast({ type: 'success', message: 'Usuario creado y perfil operativo configurado.' });
      return true;
    }} onSetActive={async (user, active) => {
      const result = await setProfileActive(user.id, active);
      if (result.error) { setToast({ type: 'error', message: result.error.message || 'No se pudo actualizar el usuario.' }); return; }
      setProfiles(current => current.map(item => item.id === user.id ? { ...item, active } : item));
      setCouriers(current => active && user.role === 'courier' ? [...current.filter(item => item.id !== user.id), { ...user, active }] : current.filter(item => item.id !== user.id));
      setToast({ type: 'success', message: `${user.full_name} quedó ${active ? 'activo' : 'inactivo'}.` });
    }} onRevoke={async user => {
      const result = await setProfileActive(user.id, false);
      if (result.error) { setToast({ type: 'error', message: result.error.message || 'No se pudo eliminar el acceso.' }); return false; }
      setProfiles(current => current.map(item => item.id === user.id ? { ...item, active: false } : item));
      setCouriers(current => current.filter(item => item.id !== user.id));
      setToast({ type: 'success', message: `Acceso de ${user.full_name} eliminado. Su historial se conserva.` });
      return true;
    }} onUpdate={async (user, values) => {
      const result = await updateProfile(user.id, values.role, values.branchCode, values.zone, values.vehicle);
      if (result.error) { setToast({ type: 'error', message: result.error.message || 'No se pudo actualizar el perfil.' }); return false; }
      setProfiles(current => current.map(item => item.id === user.id ? { ...item, ...result.data } : item));
      setToast({ type: 'success', message: 'Perfil actualizado.' });
      return true;
    }} />}
    {activeSection === 'branches' && profile.role === 'admin' && <BranchesPage branches={branches} onRefresh={refreshData} onSetActive={async (branchItem, active) => {
      const result = await setBranchActive(branchItem.code, active);
      if (result.error) { setToast({ type: 'error', message: result.error.message || 'No se pudo actualizar la sede.' }); return; }
      setBranches(current => current.map(item => item.code === branchItem.code ? { ...item, active } : item));
      setToast({ type: 'success', message: `${branchItem.name || 'La sede'} quedó ${active ? 'activa' : 'inactiva'}.` });
    }} />}
    {activeSection === 'billing' && profile.role === 'admin' && <BillingPage />}
    {activeSection === 'payroll' && profile.role === 'admin' && <PayrollPage />}
  </CentralShell></LiveContext.Provider>;
}

const URGENT_MS = 10 * 60000;

function CentralShell({ liveStatus, profile, activeSection, onSectionChange, onSignOut, pendingCount, toast, onDismissToast, children }) {
  const [navOpen, setNavOpen] = useState(false);
  const isAdmin = profile.role === 'admin';
  const titles = { dispatch: 'Despacho', sounds: 'Sonidos', earnings: 'Ganancias', tariffs: 'Tarifas', users: 'Usuarios', branches: 'Sedes', billing: 'Cobros', payroll: 'Liquidación' };
  const nav = [
    ['dispatch', 'grid', 'Despacho', pendingCount],
    ['sounds', 'bell', 'Sonidos'],
    ...(isAdmin ? [['earnings', 'trend', 'Ganancias'], ['tariffs', 'wallet', 'Tarifas'], ['billing', 'receipt', 'Cobros'], ['payroll', 'wallet', 'Liquidación'], ['users', 'users', 'Usuarios'], ['branches', 'pin', 'Sedes']] : [])
  ];
  const logo = `${import.meta.env.BASE_URL}assets/911-mensajeros-monteria.png`;
  const initials = profile.full_name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
  const go = id => { onSectionChange(id); setNavOpen(false); };
  return <div className="central-view"><div className={'web-shell' + (navOpen ? ' is-nav-open' : '')}>
    <aside className="central-sidebar">
      <div className="central-brand"><span className="brandmark brandmark--logo"><img src={logo} alt="" /></span><div className="central-brand-copy"><strong>911 Mensajeros Montería</strong><span>Central de despacho</span></div></div>
      <div className="central-context"><span className="central-context-icon"><Icon name="pin" size={14} /></span><span className="central-context-copy"><strong>Operación Montería</strong><span>{isAdmin ? 'Administración general' : 'Central de despacho'}</span></span></div>
      <p className="central-nav-label">Hoy</p>
      <nav className="side-nav" aria-label="Navegación de central">{nav.map(([id, icon, label, count]) => <button key={id} className="side-nav-item" type="button" aria-current={activeSection === id ? 'page' : undefined} onClick={() => go(id)}><Icon name={icon} size={17} />{label}{count != null && count > 0 && <span className="nav-item-count">{count}</span>}</button>)}</nav>
      <div className="sidebar-spacer" />
      <div className="operator-shift"><LiveStatus status={liveStatus} /></div>
      <div className="sidebar-operator"><div className="operator-row"><span className="avatar avatar--central" aria-hidden="true">{initials}</span><span className="operator-copy"><strong>{profile.full_name}</strong><span>{isAdmin ? 'Administración' : 'Coordinación de despacho'}</span></span><button className="operator-logout" type="button" onClick={onSignOut} title="Cerrar sesión" aria-label="Cerrar sesión"><Icon name="logout" size={16} /></button></div></div>
    </aside>
    {navOpen && <button className="central-nav-scrim" type="button" aria-label="Cerrar menú" onClick={() => setNavOpen(false)} />}
    <main className="central-main">
      <div className="central-mobilebar"><button className="central-menu-button" type="button" aria-label="Abrir menú" onClick={() => setNavOpen(true)}><Icon name="menu" size={20} /></button><span className="brandmark brandmark--logo"><img src={logo} alt="" /></span><div className="central-mobilebar-copy"><strong>{titles[activeSection]}</strong><span>Operación Montería</span></div><LiveStatus status={liveStatus} /></div>
      <div className="central-content">{children}</div>
    </main>
    {toast && <div className={'toast toast--' + toast.type} role="status"><span>{toast.message}</span><button type="button" onClick={onDismissToast} aria-label="Cerrar aviso"><Icon name="close" size={15} /></button></div>}
  </div></div>;
}

function localDay(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function EarningsPage() {
  const liveRevision = useContext(LiveContext);
  const [from, setFrom] = useState(() => localDay());
  const [to, setTo] = useState(() => localDay());
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const peso = value => '$' + Number(value || 0).toLocaleString('es-CO');

  useEffect(() => {
    let alive = true;
    companyEarnings(from, to).then(result => {
      if (!alive) return;
      setError(result.error ? result.error.message || 'No se pudieron cargar las ganancias.' : '');
      if (!result.error) setRows(result.data || []);
    });
    return () => { alive = false; };
  }, [from, to, liveRevision]);

  const add = (map, key, base, row) => {
    const item = map.get(key) || { ...base, services: 0, billed: 0, paid: 0, margin: 0, pending: 0 };
    ['services', 'billed', 'paid', 'margin', 'pending'].forEach(field => { item[field] += Number(row[field]) || 0; });
    map.set(key, item);
  };
  const byDay = new Map();
  const byCourier = new Map();
  const total = { services: 0, billed: 0, paid: 0, margin: 0, pending: 0 };
  rows.forEach(row => {
    add(byDay, row.day, { day: row.day }, row);
    add(byCourier, row.courier_id || 'none', { name: row.full_name }, row);
    Object.keys(total).forEach(field => { total[field] += Number(row[field]) || 0; });
  });
  const presets = [['Hoy', localDay(), localDay()], ['7 días', localDay(-6), localDay()], ['30 días', localDay(-29), localDay()]];
  const dayLabel = day => new Date(day + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' });

  return <section className="admin-page">
    <PageIntro title="Ganancias de la mensajería" description="Lo que se cobra a las farmacias menos lo que se paga a los domiciliarios, en servicios entregados. Se actualiza solo." />
    <div className="earnings-filters">
      <div className="live-tabs">{presets.map(([label, start, end]) => <button key={label} type="button" className={from === start && to === end ? 'is-active' : ''} onClick={() => { setFrom(start); setTo(end); }}>{label}</button>)}</div>
      <label>Desde<input type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} /></label>
      <label>Hasta<input type="date" value={to} min={from} onChange={event => setTo(event.target.value)} /></label>
    </div>
    {error && <div className="error-strip"><Icon name="close" size={16} />{error}</div>}
    <section className="ops-kpis" aria-label="Resumen de ganancias">
      <div className="ops-kpi"><div className="ops-kpi-label"><Icon name="trend" size={14} />Ganancia</div><div className="ops-kpi-value earnings-margin">{peso(total.margin)}</div><div className="ops-kpi-note">Para la mensajería</div></div>
      <div className="ops-kpi"><div className="ops-kpi-label"><Icon name="receipt" size={14} />Cobrado</div><div className="ops-kpi-value">{peso(total.billed)}</div><div className="ops-kpi-note">A las farmacias</div></div>
      <div className="ops-kpi"><div className="ops-kpi-label"><Icon name="wallet" size={14} />Pagado</div><div className="ops-kpi-value">{peso(total.paid)}</div><div className="ops-kpi-note">A los domiciliarios</div></div>
      <div className="ops-kpi"><div className="ops-kpi-label"><Icon name="check" size={14} />Servicios</div><div className="ops-kpi-value">{total.services}</div><div className={'ops-kpi-note' + (total.pending ? ' is-alert' : '')}>{total.pending ? `${total.pending} sin tarifa completa` : 'Entregados'}</div></div>
    </section>
    <EarningsTable title="Por domiciliario" first="Domiciliario" rows={[...byCourier.values()].sort((a, b) => b.margin - a.margin).map(item => [item.name, item])} peso={peso} />
    <EarningsTable title="Por día" first="Día" rows={[...byDay.values()].map(item => [dayLabel(item.day), item])} peso={peso} />
  </section>;
}

function EarningsTable({ title, first, rows, peso }) {
  return <section className="ops-panel live-services">
    <div className="ops-panel-head"><div className="ops-panel-title"><h2>{title}</h2><span className="ops-count">{rows.length}</span></div></div>
    {rows.length ? <div className="live-scroll"><table className="live-table earnings-table"><thead><tr><th>{first}</th><th>Servicios</th><th>Cobrado</th><th>Pagado</th><th>Ganancia</th></tr></thead><tbody>{rows.map(([label, item]) => <tr key={label}><td><strong>{label}</strong></td><td>{item.services}</td><td>{peso(item.billed)}</td><td>{peso(item.paid)}</td><td><strong className="earnings-margin">{peso(item.margin)}</strong></td></tr>)}</tbody></table></div> : <div className="queue-empty"><Icon name="trend" size={24} /><strong>Sin entregas en este periodo</strong></div>}
  </section>;
}

function RatesPage({ rates, onSave, readOnly }) {
  return <section className="rates-page"><div className="rates-intro"><div><p>Configuración operativa</p><h2>Tarifas que la central reconoce.</h2><span>{readOnly ? 'Consulta los valores publicados. Solo administración puede modificarlos.' : 'Define por separado lo que paga la farmacia y lo que recibe el domiciliario.'}</span></div></div><div className="rates-list">{rates.map(rate => <RateRow key={rate.id} rate={rate} onSave={onSave} readOnly={readOnly} />)}{!rates.length && <div className="queue-empty"><Icon name="wallet" size={24} /><strong>No hay tarifas cargadas</strong><span>La migración de Supabase debe tener los valores iniciales.</span></div>}</div></section>;
}

function RateRow({ rate, onSave, readOnly }) {
  const [generalPrice, setGeneralPrice] = useState(rate.general_price_cop == null ? (rate.price_cop == null ? '' : String(rate.price_cop)) : String(rate.general_price_cop));
  const [courierPrice, setCourierPrice] = useState(rate.courier_price_cop == null ? (rate.price_cop == null ? '' : String(rate.price_cop)) : String(rate.courier_price_cop));
  const [generalConfirmed, setGeneralConfirmed] = useState(rate.general_price_confirmed ?? rate.price_confirmed);
  const [courierConfirmed, setCourierConfirmed] = useState(rate.courier_price_confirmed ?? rate.price_confirmed);
  // Si otro administrador cambia la tarifa, se ve aquí sin recargar.
  useEffect(() => {
    setGeneralPrice(rate.general_price_cop == null ? (rate.price_cop == null ? '' : String(rate.price_cop)) : String(rate.general_price_cop));
    setCourierPrice(rate.courier_price_cop == null ? (rate.price_cop == null ? '' : String(rate.price_cop)) : String(rate.courier_price_cop));
    setGeneralConfirmed(rate.general_price_confirmed ?? rate.price_confirmed);
    setCourierConfirmed(rate.courier_price_confirmed ?? rate.price_confirmed);
  }, [rate.general_price_cop, rate.courier_price_cop, rate.price_cop, rate.general_price_confirmed, rate.courier_price_confirmed, rate.price_confirmed]);
  return <div className="rate-row"><div className="rate-copy"><strong>{rate.label}</strong><span>{rate.payment_method === 'card' ? 'Datáfono' : rate.payment_method === 'cash' ? 'Efectivo' : 'No aplica'} · {rate.notes || 'Sin nota'}</span></div><label className="rate-input"><span>Precio general · farmacia</span><input value={generalPrice} onChange={event => setGeneralPrice(event.target.value.replace(/\D/g, ''))} placeholder="Por confirmar" inputMode="numeric" readOnly={readOnly} /></label><label className="rate-input"><span>Precio domiciliario</span><input value={courierPrice} onChange={event => setCourierPrice(event.target.value.replace(/\D/g, ''))} placeholder="Por confirmar" inputMode="numeric" readOnly={readOnly} /></label><div className="rate-confirm-stack"><label className="rate-confirm"><input type="checkbox" checked={generalConfirmed} onChange={event => setGeneralConfirmed(event.target.checked)} disabled={readOnly} /><span>General confirmada</span></label><label className="rate-confirm"><input type="checkbox" checked={courierConfirmed} onChange={event => setCourierConfirmed(event.target.checked)} disabled={readOnly} /><span>Domiciliario confirmado</span></label></div>{readOnly ? <span className="read-only-note">Solo lectura</span> : <button className="button button--outline button--small" type="button" onClick={() => onSave(rate, generalPrice, courierPrice, generalConfirmed, courierConfirmed)}>Guardar</button>}</div>;
}

function SoundsPage() {
  const [chosen, setChosen] = useState(() => Object.fromEntries(CENTRAL_ALERTS.map(item => [item.key, toneFor(item.key)])));
  const genres = [...new Set(TONES.map(tone => tone.genre))];
  const player = useRef(null);
  function preview(id) {
    player.current?.pause();
    player.current = new Audio(toneUrl(id));
    player.current.play().catch(() => {});
  }
  function choose(key, id) {
    saveTone(key, id);
    setChosen(current => ({ ...current, [key]: id }));
    preview(id);
  }
  return <section className="admin-page"><PageIntro kicker="Central" title="Sonidos" description="Elige el tono de cada alerta. Se guarda en este navegador." /><div className="admin-list">{CENTRAL_ALERTS.map(alert => <article className="admin-row" key={alert.key}><div className="admin-row-main"><div className="admin-row-title"><strong>{alert.label}</strong></div><select className="tone-select" aria-label={`Tono para ${alert.label}`} value={chosen[alert.key]} onChange={event => choose(alert.key, event.target.value)}>{genres.map(genre => <optgroup key={genre} label={genre}>{TONES.filter(tone => tone.genre === genre).map(tone => <option key={tone.id} value={tone.id}>{tone.label}</option>)}</optgroup>)}</select></div><div className="admin-row-actions"><button className="button button--outline button--small" type="button" onClick={() => preview(chosen[alert.key])}>Probar</button></div></article>)}</div></section>;
}

function PageIntro({ kicker = 'Administración', title, description, action }) {
  return <div className="admin-page-intro"><div><p>{kicker}</p><h2>{title}</h2>{description && <span>{description}</span>}</div>{action}</div>;
}

function UsersPage({ profiles, branches, onRefresh, onCreate, onSetActive, onRevoke, onUpdate }) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const query = search.trim().toLowerCase();
  const filtered = profiles.filter(user => !query || [user.full_name, user.phone, user.role, user.zone].filter(Boolean).join(' ').toLowerCase().includes(query));
  return <section className="admin-page"><PageIntro title="Usuarios y permisos" description="Activa, desactiva y elimina el acceso operativo sin borrar el historial." action={<div className="intro-actions"><button className="button button--primary" type="button" onClick={() => setCreating(current => !current)}><Icon name="plus" size={16} />{creating ? 'Cerrar formulario' : 'Nuevo usuario'}</button><button className="button button--outline" type="button" onClick={onRefresh}><Icon name="refresh" size={16} />Actualizar</button></div>} />{creating && <CreateUserForm branches={branches} onCreate={async values => { const ok = await onCreate(values); if (ok) setCreating(false); return ok; }} />}<div className="admin-toolbar"><label className="search-field"><span>Buscar usuario</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre, teléfono o rol" /></label><span className="admin-count">{filtered.length} de {profiles.length}</span></div><div className="admin-list">{filtered.map(user => <UserRow key={user.id} user={user} branches={branches} onSetActive={onSetActive} onRevoke={onRevoke} onUpdate={onUpdate} />)}{!filtered.length && <EmptyAdmin icon="users" title="No hay usuarios" text="Los usuarios aparecerán cuando se creen en Supabase Auth y se configure su perfil." />}</div></section>;
}

function CreateUserForm({ branches, onCreate }) {
  const [values, setValues] = useState({ username: '', full_name: '', password: '', phone: '', role: 'courier', branch_code: '', zone: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  function update(key, value) { setValues(current => ({ ...current, [key]: value })); setError(''); }
  async function submit(event) { event.preventDefault(); if (!/^[a-z0-9._-]{3,32}$/i.test(values.username.trim())) { setError('El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.'); return; } if (values.password.length < 8) { setError('La clave temporal debe tener mínimo 8 caracteres.'); return; } setBusy(true); const ok = await onCreate({ ...values, username: values.username.trim().toLowerCase() }); if (!ok) setError('No se pudo crear. Revisa el mensaje de la central y los datos.'); setBusy(false); }
  return <form className="create-user-card" onSubmit={submit}><div><p className="section-kicker">Alta segura</p><h3>Crear usuario operativo</h3><span>El usuario es el dato que la persona escribirá para entrar. La clave es temporal y debe cambiarse después.</span></div><div className="create-user-grid"><label>Usuario de acceso<input required value={values.username} onChange={event => update('username', event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 32))} placeholder="leo.acosta" autoCapitalize="none" /></label><label>Nombre completo<input required value={values.full_name} onChange={event => update('full_name', event.target.value)} /></label><label>Clave temporal<input required type="password" minLength="8" value={values.password} onChange={event => update('password', event.target.value)} /></label><label>Teléfono<input value={values.phone} onChange={event => update('phone', event.target.value)} placeholder="3001234567" /></label><label>Rol<select value={values.role} onChange={event => update('role', event.target.value)}><option value="courier">Domiciliario</option><option value="pharmacy">Farmacia</option><option value="central">Central</option><option value="admin">Administrador</option></select></label><label>Sede<select value={values.branch_code} onChange={event => update('branch_code', event.target.value)}><option value="">Sin sede</option>{branches.filter(branch => branch.active).map(branch => <option key={branch.id} value={branch.code}>{branch.code} · {branch.name}</option>)}</select></label><label>Zona<input value={values.zone} onChange={event => update('zone', event.target.value)} placeholder="Ej. Granja" /></label></div>{error && <div className="auth-error" role="alert"><Icon name="close" size={15} />{error}</div>}<div className="create-user-actions"><button className="button button--primary" type="submit" disabled={busy}>{busy ? 'Creando…' : 'Crear usuario'}</button></div></form>;
}

function UserRow({ user, branches, onSetActive, onRevoke, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [values, setValues] = useState({ role: user.role, branchCode: branches.find(branch => branch.id === user.branch_id)?.code || '', zone: user.zone || '', vehicle: user.vehicle || '' });
  const initials = (user.full_name || '?').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
  async function save() { setBusy(true); const ok = await onUpdate(user, values); setBusy(false); if (ok) setEditing(false); }
  async function toggle() { setBusy(true); await onSetActive(user, !user.active); setBusy(false); }
  async function revoke() { setConfirming(false); setBusy(true); await onRevoke(user); setBusy(false); }
  return <article className={'admin-row ' + (!user.active ? 'is-muted' : '')}><div className="admin-avatar">{initials}</div><div className="admin-row-main"><div className="admin-row-title"><strong>{user.full_name || 'Sin nombre'}</strong><span className={'role-pill role-pill--' + user.role}>{user.role}</span><span className={'state-pill ' + (user.active ? 'is-on' : 'is-off')}>{user.active ? 'Activo' : 'Inactivo'}</span></div><span className="admin-row-meta">{user.phone || 'Sin teléfono'}{user.zone ? ` · ${user.zone}` : ''}{user.vehicle ? ` · ${user.vehicle}` : ''}</span>{editing && <div className="inline-editor"><label>Rol<select value={values.role} onChange={event => setValues(current => ({ ...current, role: event.target.value }))}><option value="courier">Domiciliario</option><option value="pharmacy">Farmacia</option><option value="central">Central</option><option value="admin">Administrador</option></select></label><label>Sede<select value={values.branchCode} onChange={event => setValues(current => ({ ...current, branchCode: event.target.value }))}><option value="">Sin sede</option>{branches.map(branch => <option key={branch.id} value={branch.code}>{branch.code} · {branch.name}</option>)}</select></label><label>Zona<input value={values.zone} onChange={event => setValues(current => ({ ...current, zone: event.target.value }))} placeholder="Zona operativa" /></label><label>Vehículo<input value={values.vehicle} onChange={event => setValues(current => ({ ...current, vehicle: event.target.value }))} placeholder="Moto / placa" /></label></div>}</div><div className="admin-row-actions">{editing ? <><button className="button button--primary button--small" type="button" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button><button className="button button--outline button--small" type="button" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button></> : <button className="button button--outline button--small" type="button" disabled={busy} onClick={() => setEditing(true)}>Editar</button>}<button className={'button button--small ' + (user.active ? 'button--danger-outline' : 'button--outline')} type="button" disabled={busy} onClick={toggle}>{user.active ? 'Desactivar' : 'Activar'}</button>{confirming ? <><button className="button button--danger-outline button--small" type="button" disabled={busy} onClick={revoke}>Sí, eliminar (conserva historial)</button><button className="button button--outline button--small" type="button" disabled={busy} onClick={() => setConfirming(false)}>No</button></> : <button className="button button--danger-outline button--small" type="button" disabled={busy || !user.active} onClick={() => setConfirming(true)}>{user.active ? 'Eliminar acceso' : 'Acceso eliminado'}</button>}</div></article>;
}

function BranchesPage({ branches, onRefresh, onSetActive }) {
  return <section className="admin-page"><PageIntro title="Sedes y cobertura" description="Controla qué farmacias pueden publicar servicios y revisa la información de sus puntos." action={<button className="button button--outline" type="button" onClick={onRefresh}><Icon name="refresh" size={16} />Actualizar</button>} /><div className="admin-list admin-list--branches">{branches.map(branch => <article className={'admin-row branch-row ' + (!branch.active ? 'is-muted' : '')} key={branch.id}><div className="branch-code">{branch.code}</div><div className="admin-row-main"><div className="admin-row-title"><strong>{branch.name || `farmanorte ${branch.code}`}</strong><span className={'state-pill ' + (branch.active ? 'is-on' : 'is-off')}>{branch.active ? 'Activa' : 'Inactiva'}</span></div><span className="admin-row-meta">{branch.address || 'Dirección pendiente'}{branch.neighborhood ? ` · ${branch.neighborhood}` : ''}</span><span className="branch-location-state">{branch.location_confirmed ? 'Ubicación confirmada' : 'Ubicación pendiente de confirmar'}</span></div><div className="admin-row-actions"><button className={'button button--small ' + (branch.active ? 'button--danger-outline' : 'button--outline')} type="button" onClick={() => onSetActive(branch, !branch.active)}>{branch.active ? 'Desactivar' : 'Activar'}</button></div></article>)}{!branches.length && <EmptyAdmin icon="pin" title="No hay sedes cargadas" text="Las sedes se crean desde las migraciones de Supabase." />}</div></section>;
}

function DateRange({ from, to, setFrom, setTo, onLoad, loading }) {
  return <div className="date-range"><label><span>Desde</span><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label><span>Hasta</span><input type="date" value={to} onChange={event => setTo(event.target.value)} /></label><button className="button button--primary" type="button" onClick={onLoad} disabled={loading}>{loading ? 'Cargando…' : 'Consultar'}</button></div>;
}

// En hora de Colombia: con UTC, desde las 7 p. m. "hoy" ya sería mañana.
function usePeriod() {
  return [localDay(-6), localDay()];
}

function BillingPage() {
  const [initialFrom, initialTo] = usePeriod();
  const [from, setFrom] = useState(initialFrom); const [to, setTo] = useState(initialTo);
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function load() { setLoading(true); setError(''); const result = await billingReport(from, to); if (result.error) setError(result.error.message || 'No se pudo cargar el cobro.'); else setRows(result.data || []); setLoading(false); }
  const liveRevision = useContext(LiveContext);
  useEffect(() => { load(); }, [liveRevision]);
  const totalFees = rows.reduce((sum, row) => sum + Number(row.fee_total || 0), 0);
  return <section className="admin-page"><PageIntro title="Cobro a droguerías" description="Servicios entregados y valores que debe reconocer cada sede en el periodo." /><DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onLoad={load} loading={loading} />{error && <div className="error-strip"><Icon name="close" size={16} />{error}</div>}<div className="report-highlight"><span>Total de tarifas registradas</span><strong>{money(totalFees)}</strong><small>{rows.length} sedes con datos en el periodo</small></div><ReportTable headers={['Zona', 'Sede', 'Servicios', 'Medicamentos', 'Tarifas', 'Pendientes']} rows={rows.map(row => [row.zone_name || '—', `${row.branch_code} · ${row.branch_name}`, row.services, money(row.medicine_total), money(row.fee_total), row.fees_pending || 0])} empty="No hay servicios entregados en este periodo." /></section>;
}

function PayrollPage() {
  const [initialFrom, initialTo] = usePeriod();
  const [from, setFrom] = useState(initialFrom); const [to, setTo] = useState(initialTo);
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  async function load() { setLoading(true); setError(''); const result = await payrollReport(from, to); if (result.error) setError(result.error.message || 'No se pudo cargar la liquidación.'); else setRows(result.data || []); setLoading(false); }
  const liveRevision = useContext(LiveContext);
  useEffect(() => { load(); }, [liveRevision]);
  const total = rows.reduce((sum, row) => sum + Number(row.fee_total || 0), 0);
  const pending = rows.reduce((sum, row) => sum + Number(row.pending_total || 0), 0);
  return <section className="admin-page"><PageIntro title="Liquidación de domiciliarios" description="Ganancias de entregas completadas agrupadas por persona. Los equivalentes se revisan en Supabase." /><DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onLoad={load} loading={loading} />{error && <div className="error-strip"><Icon name="close" size={16} />{error}</div>}<div className="report-highlights"><div className="report-highlight"><span>Total generado</span><strong>{money(total)}</strong><small>Entregas del periodo</small></div><div className="report-highlight report-highlight--amber"><span>Pendiente de pago</span><strong>{money(pending)}</strong><small>Según días liquidados</small></div></div><ReportTable headers={['Domiciliario', 'Estado', 'Servicios', 'Ganancia', 'Pendiente']} rows={rows.map(row => [row.full_name, row.active ? 'Activo' : 'Inactivo', row.services, money(row.fee_total), money(row.pending_total)])} empty="No hay entregas registradas en este periodo." /></section>;
}

function ReportTable({ headers, rows, empty }) {
  return <div className="report-table-wrap"><table className="report-table"><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>{!rows.length && <div className="table-empty"><span className="table-empty-icon"><Icon name="receipt" size={23} /></span><strong>{empty}</strong></div>}</div>;
}

function EmptyAdmin({ icon, title, text }) { return <div className="queue-empty admin-empty"><Icon name={icon} size={24} /><strong>{title}</strong><span>{text}</span></div>; }
function money(value) { return '$' + Number(value || 0).toLocaleString('es-CO'); }

createRoot(document.getElementById('root')).render(<App />);
