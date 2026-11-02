import { useEffect, useMemo, useState } from 'react';
import { getCourierRoute, listReassignments, listWorkload, SERVICE_LABELS, STATUS_LABELS } from '../lib/operations.js';
import { Icon } from './Icon.jsx';
import { OperationsMap, pointOf } from './OperationsMap.jsx';

const LATE_MINUTES = 5;
// Más espera, parpadeo más rápido: 5, 7 y 10 minutos.
const waitLevel = minutes => (minutes >= 10 ? 3 : minutes >= 7 ? 2 : minutes >= LATE_MINUTES ? 1 : 0);
const AVATAR_TONES = ['andres', 'marcela', 'kevin', 'laura', 'leidy'];
const money = value => (value == null ? 'Por confirmar' : '$' + Number(value).toLocaleString('es-CO'));
const initials = name => String(name || '911').trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
const toneOf = id => AVATAR_TONES[[...String(id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES.length];
const minutesSince = value => Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
const clock = value => (value ? new Date(value).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '—');
const waitLabel = minutes => (minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${Math.floor(minutes / 1440)} d`);
const GPS_FRESH_MINUTES = 10;
const hasFreshGps = courier => Boolean(courier.last_location_at) && minutesSince(courier.last_location_at) <= GPS_FRESH_MINUTES;
// Primero quien reporta, luego quien dejó de reportar y al final quien está en pausa.
const signalRank = courier => (courier.available === false ? 2 : hasFreshGps(courier) ? 0 : 1);
const CONGESTED_MINUTES = 60;
const duration = minutes => (minutes < 60 ? `~${minutes} min` : `~${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`);
const loadLabel = load => (load?.open_services ? `${load.open_services} servicio${load.open_services === 1 ? '' : 's'} · ${duration(load.estimated_minutes)}` : 'Sin servicios');
const isToday = value => value && new Date(value).toDateString() === new Date().toDateString();

function serviceKey(service) {
  const card = service.payment_method === 'card';
  switch (service.service_type) {
    case 'home': return card ? 'dataphone' : 'cash';
    case 'home_cross': return card ? 'crossDataphone' : 'homeCross';
    case 'home_buy': return card ? 'buyDataphone' : 'homeBuy';
    case 'home_buy_cross': return card ? 'homeBuyCrossDataphone' : 'homeBuyCross';
    case 'buy': return 'buyOnly';
    case 'cross': return 'crossOnly';
    default: return 'change';
  }
}

function serviceLabel(service) {
  const card = service.payment_method === 'card';
  switch (service.service_type) {
    case 'home': return card ? 'Domicilio con datáfono' : 'Domicilio en efectivo';
    case 'home_cross': return card ? 'Domicilio con cruce y datáfono' : 'Domicilio con cruce';
    case 'home_buy': return card ? 'Domicilio con compra y datáfono' : 'Domicilio con compra';
    case 'home_buy_cross': return card ? 'Domicilio con compra, cruce y datáfono' : 'Domicilio con compra y cruce';
    default: return SERVICE_LABELS[service.service_type] || service.service_type;
  }
}

function destinationLabel(service) {
  if (service.service_type === 'buy') return service.buy_place || 'Compra externa';
  if (service.service_type === 'cross') return `FN ${service.branch_code}`;
  if (service.service_type === 'change') return `FN ${service.branch_code}`;
  return service.neighborhood || service.delivery_address || 'Dirección por confirmar';
}

// Un cruce solo arranca en la sede que tiene el producto y termina en la que lo pidió.
const startCode = service => (service.service_type === 'cross' && service.cross_branch_code) || service.branch_code;

function distanceKm(a, b) {
  if (!a || !b) return null;
  const rad = degrees => (degrees * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
const km = value => value.toFixed(1).replace('.', ',') + ' km';

export function DispatchPage({ services, couriers, branches, loading, error, liveStatus, onRefresh, onAssign, onReassign, onEdit, onCancel, alertService, onDismissAlert }) {
  const [selectedId, setSelectedId] = useState(null);
  const [liveTab, setLiveTab] = useState('active');
  const [workload, setWorkload] = useState({});
  const [routeCourierId, setRouteCourierId] = useState(null);
  const [routeStops, setRouteStops] = useState([]);
  const [, tick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => tick(n => n + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  // La carga y la ruta se recalculan con cada cambio de los servicios.
  useEffect(() => {
    let current = true;
    listWorkload().then(({ data, error: failure }) => {
      if (current && !failure) setWorkload(Object.fromEntries((data || []).map(item => [item.courier_id, item])));
    });
    return () => { current = false; };
  }, [services]);

  useEffect(() => {
    if (!routeCourierId) { setRouteStops([]); return undefined; }
    let current = true;
    getCourierRoute(routeCourierId).then(({ data, error: failure }) => {
      if (current && !failure) setRouteStops(data || []);
    });
    return () => { current = false; };
  }, [routeCourierId, services]);

  const toggleRoute = id => setRouteCourierId(value => (value === id ? null : id));
  const busyCouriers = couriers.filter(item => workload[item.id]?.open_services).sort((a, b) => workload[b.id].estimated_minutes - workload[a.id].estimated_minutes);

  const branchByCode = useMemo(() => Object.fromEntries(branches.map(branch => [branch.code, branch])), [branches]);
  const queue = useMemo(() => services.filter(item => item.status === 'unassigned').sort((a, b) => new Date(a.created_at) - new Date(b.created_at)), [services]);
  const active = useMemo(() => services.filter(item => ['assigned', 'enroute'].includes(item.status)), [services]);
  const deliveredToday = useMemo(() => services.filter(item => item.status === 'delivered' && isToday(item.delivered_at)), [services]);
  const selected = services.find(item => item.id === selectedId) || queue[0] || null;
  const lateCount = queue.filter(item => minutesSince(item.created_at) >= LATE_MINUTES).length;
  const availableCount = couriers.filter(item => item.available === true && hasFreshGps(item)).length;
  const dateLabel = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const timeLabel = clock(new Date());

  const startBranch = selected ? branchByCode[startCode(selected)] : null;
  const origin = startBranch ? pointOf(startBranch.latitude, startBranch.longitude) : null;
  const destination = !selected ? null : selected.service_type === 'cross' ? pointOf(branchByCode[selected.branch_code]?.latitude, branchByCode[selected.branch_code]?.longitude) : pointOf(selected.destination_lat, selected.destination_lng);
  const routeKm = distanceKm(origin, destination);

  const liveRows = liveTab === 'active' ? active : deliveredToday;

  return <>
    <header className="central-page-head">
      <div className="central-page-head-title"><h1>Despacho de hoy</h1><p>{dateLabel} · {timeLabel} · central Montería</p></div>
      <div className="central-page-head-actions">
        <span className={'central-live-pill central-live-pill--' + liveStatus}><span className="live-dot live-dot--green" aria-hidden="true" />{{ live: 'En vivo', reconnecting: 'Reconectando', offline: 'Sin conexión' }[liveStatus]}</span>
        <button className="central-refresh" type="button" onClick={onRefresh} disabled={loading}><Icon name="refresh" size={14} />{loading ? 'Actualizando…' : 'Actualizar'}</button>
      </div>
    </header>

    {error && <div className="error-strip"><Icon name="close" size={16} />{error}</div>}

    {alertService && <div className="central-alert" role="status">
      <span className="central-alert-icon"><Icon name="bell" size={18} /></span>
      <div className="central-alert-copy"><strong>Nuevo servicio de farmanorte {alertService.branch_code}</strong><span>{alertService.code} · {serviceLabel(alertService)}</span></div>
      <button className="central-alert-action" type="button" onClick={() => { setSelectedId(alertService.id); onDismissAlert(); }}>Atender ahora</button>
      <button className="central-alert-close" type="button" aria-label="Cerrar aviso" onClick={onDismissAlert}><Icon name="close" size={16} /></button>
    </div>}

    <section className="ops-kpis" aria-label="Resumen del día">
      <div className="ops-kpi"><div className="ops-kpi-label"><Icon name="bell" size={14} />Sin asignar</div><div className={'ops-kpi-value' + (queue.length ? ' is-alert' : '')}>{queue.length}</div><div className={'ops-kpi-note' + (lateCount ? ' is-alert' : '')}>{lateCount ? `${lateCount} lleva${lateCount === 1 ? '' : 'n'} más de ${LATE_MINUTES} min` : 'Requieren decisión'}</div></div>
      <div className="ops-kpi"><div className="ops-kpi-label"><Icon name="route" size={14} />En curso</div><div className="ops-kpi-value">{active.length}</div><div className="ops-kpi-note">Asignados o en camino</div></div>
      <div className="ops-kpi"><div className="ops-kpi-label"><Icon name="check" size={14} />Entregados hoy</div><div className="ops-kpi-value">{deliveredToday.length}</div><div className="ops-kpi-note">Consecutivos cerrados</div></div>
      <div className="ops-kpi"><div className="ops-kpi-label"><Icon name="users" size={14} />Domiciliarios</div><div className="ops-kpi-value">{couriers.length}</div><div className="ops-kpi-note">{availableCount} disponible{availableCount === 1 ? '' : 's'} ahora</div></div>
    </section>

    <div className="dispatch-grid">
      <section className="ops-panel queue-panel" aria-labelledby="queue-title">
        <div className="ops-panel-head"><div className="ops-panel-title"><h2 id="queue-title">Por asignar</h2><span className="ops-count">{queue.length}</span></div><span className="ops-panel-sub">Ordenados por espera</span></div>
        <div className="queue-body">
          {queue.map(service => {
            const wait = minutesSince(service.created_at);
            const late = wait >= LATE_MINUTES;
            const level = waitLevel(wait);
            const isSelected = selected?.id === service.id;
            return <button key={service.id} className={'queue-card' + (isSelected ? ' is-selected' : '') + (late ? ' is-late' : '') + (level ? ' wait-level-' + level : '')} type="button" aria-pressed={isSelected} onClick={() => setSelectedId(service.id)}>
              <div className="queue-card-top"><span className="queue-code" data-svc={serviceKey(service)}><span className="svc-dot" aria-hidden="true" />{service.code}</span><span className={'queue-wait' + (late ? ' is-late' : wait < 3 ? ' is-new' : '')}><Icon name="clock" size={12} />{waitLabel(wait)}</span></div>
              {level > 0 && <span className="queue-priority"><Icon name="bell" size={12} />{level === 3 ? 'Urgente: asignar ya' : 'Priorizar'}</span>}
              {!isToday(service.created_at) && <span className="queue-old">Publicado {new Date(service.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>}
              <div className="queue-service">{serviceLabel(service)}</div>
              <div className="queue-route"><span>FN {startCode(service)}</span><span className="route-arrow">→</span><span>{destinationLabel(service)}</span></div>
              <div className="queue-card-foot"><span className="queue-fee">{service.general_fee_cop != null && money(service.general_fee_cop)}</span><span className="queue-cta">Asignar<Icon name="arrow" size={12} /></span></div>
            </button>;
          })}
          {!loading && !queue.length && <div className="queue-empty"><Icon name="check" size={24} /><strong>Todo asignado</strong><span>Cuando una farmacia publique, sonará la alerta y aparecerá aquí.</span></div>}
        </div>
      </section>

      <section className="ops-panel map-panel" aria-labelledby="map-title">
        <div className="ops-panel-head">
          <div className="ops-panel-title"><h2 id="map-title">Mapa en vivo</h2><span className="live-dot live-dot--green" aria-hidden="true" style={{ marginLeft: 2 }} /></div>
          <div className="map-head-right"><div className="map-legend" role="group" aria-label="Convenciones del mapa">
            <span className="map-legend-item"><span className="legend-swatch legend-swatch--free" />Libre</span>
            <span className="map-legend-item"><span className="legend-swatch legend-swatch--busy" />En servicio</span>
            <span className="map-legend-item"><span className="legend-swatch legend-swatch--branch" />Sede</span>
          </div></div>
        </div>
        <div className="map-board"><OperationsMap branches={branches} couriers={couriers} services={services} selected={selected} routeCourierId={routeCourierId} routeStops={routeStops} /></div>
        {selected && <div className="map-body-foot">
          <div className="map-selection"><div className="map-selection-top" data-svc={serviceKey(selected)}><span className="svc-dot" aria-hidden="true" />{serviceLabel(selected)}</div><strong>{selected.code} · FN {startCode(selected)} → {destinationLabel(selected)}</strong></div>
          {routeKm != null && <span className="map-selection-route"><Icon name="route" size={13} /><strong>{km(routeKm)}</strong> · en línea recta</span>}
        </div>}
      </section>

      <AssignPanel service={selected} couriers={couriers} services={services} origin={origin} branchByCode={branchByCode} onAssign={onAssign} onReassign={onReassign} onEdit={onEdit} onCancel={onCancel} workload={workload} routeCourierId={routeCourierId} routeStops={routeStops} onToggleRoute={toggleRoute} />
    </div>

    <section className="ops-panel live-services" aria-labelledby="live-title">
      <div className="ops-panel-head">
        <div className="ops-panel-title"><h2 id="live-title">{liveTab === 'active' ? 'Servicios en curso' : 'Entregados hoy'}</h2><span className="ops-count">{liveRows.length}</span></div>
        <div className="live-tabs"><button type="button" className={liveTab === 'active' ? 'is-active' : ''} onClick={() => setLiveTab('active')}>En curso</button><button type="button" className={liveTab === 'done' ? 'is-active' : ''} onClick={() => setLiveTab('done')}>Entregados</button></div>
      </div>
      {liveRows.length ? <div className="live-scroll"><table className="live-table">
        <thead><tr><th>Consecutivo</th><th>Servicio</th><th>Ruta</th><th>Domiciliario</th><th>Estado</th><th>{liveTab === 'active' ? 'Inicio' : 'Entrega'}</th></tr></thead>
        <tbody>{liveRows.map(service => {
          const courier = couriers.find(item => item.id === service.assigned_courier_id);
          return <tr key={service.id} className="is-clickable" onClick={() => setSelectedId(service.id)}>
            <td><span className="live-code">{service.code}</span></td>
            <td><div className="live-service-cell" data-svc={serviceKey(service)}><span className="svc-dot" aria-hidden="true" /><span>{serviceLabel(service)}</span></div></td>
            <td><div className="live-route"><Icon name="route" size={13} />FN {startCode(service)} → {destinationLabel(service)}</div></td>
            <td><div className="live-courier"><span className={'avatar avatar--' + toneOf(service.assigned_courier_id)} aria-hidden="true">{initials(courier?.full_name)}</span><span>{courier?.full_name || 'Sin domiciliario'}</span></div></td>
            <td><span className={'status-pill status-pill--' + service.status}>{STATUS_LABELS[service.status]}</span></td>
            <td><span className="live-time"><strong>{clock(liveTab === 'active' ? service.started_at || service.assigned_at : service.delivered_at)}</strong>{liveTab === 'active' ? (service.started_at ? 'Salió de la sede' : 'Asignado') : 'Entregado'}</span></td>
          </tr>;
        })}</tbody>
      </table></div> : <div className="queue-empty"><Icon name="route" size={24} /><strong>{liveTab === 'active' ? 'No hay servicios en camino' : 'Aún no hay entregas hoy'}</strong></div>}
    </section>

    <section className="ops-panel live-services" aria-labelledby="routes-title">
      <div className="ops-panel-head"><div className="ops-panel-title"><h2 id="routes-title">Rutas de domiciliarios</h2><span className="ops-count">{busyCouriers.length}</span></div><span className="ops-panel-sub">Tiempo aproximado para terminar</span></div>
      {busyCouriers.length ? <div className="route-list">{busyCouriers.map(courier => {
        const load = workload[courier.id];
        const open = routeCourierId === courier.id;
        return <div className="route-row" key={courier.id}>
          <button className="route-row-head" type="button" aria-expanded={open} onClick={() => toggleRoute(courier.id)}>
            <span className={'avatar avatar--' + toneOf(courier.id)} aria-hidden="true">{initials(courier.full_name)}</span>
            <strong>{courier.full_name}</strong>
            {load.estimated_minutes >= CONGESTED_MINUTES && <span className="route-congested">Congestionado</span>}
            <span className="route-row-load">{loadLabel(load)} · {load.pending_stops} parada{load.pending_stops === 1 ? '' : 's'}</span>
            <span className="route-row-toggle">{open ? 'Ocultar' : 'Ver ruta'}</span>
          </button>
          {open && <RouteStops stops={routeStops} />}
        </div>;
      })}</div> : <div className="queue-empty"><Icon name="route" size={24} /><strong>Ningún domiciliario tiene servicios en curso</strong></div>}
    </section>
  </>;
}

function RouteStops({ stops }) {
  if (!stops.length) return <p className="route-empty">Sin paradas pendientes.</p>;
  return <ol className="route-stops">{stops.map(stop => <li key={stop.stop_no}><span className="route-stop-title"><strong>{stop.service_code}</strong> {stop.stop_title}</span><span className="route-stop-time">{duration(stop.minutes_total)}</span></li>)}</ol>;
}

function CancelService({ service, onCancel }) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  useEffect(() => { setAsking(false); setReason(''); }, [service.id]);
  if (!asking) return <button className="assign-cancel" type="button" onClick={() => setAsking(true)}>Cancelar servicio</button>;
  return <div className="assign-cancel-ask">
    <input value={reason} onChange={event => setReason(event.target.value)} placeholder="Motivo (opcional)" aria-label="Motivo de la cancelación" />
    <button className="assign-cancel" type="button" onClick={() => onCancel(service, reason.trim())}>Confirmar cancelación</button>
    <button className="assign-reassign" type="button" onClick={() => setAsking(false)}>No cancelar</button>
  </div>;
}

function ServiceEditor({ service, onSave }) {
  const initial = { customer_name: service.customer_name || '', customer_phone: service.customer_phone || '', delivery_address: service.delivery_address || '', neighborhood: service.neighborhood || '', invoice_code: service.invoice_code || '', note: service.note || '', payment_method: service.payment_method };
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValues(initial), [service.id, service.updated_at]);
  const field = (key, label, full) => <label className={full ? 'is-full' : ''}>{label}<input value={values[key]} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} /></label>;
  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    await onSave(service, values);
    setSaving(false);
  };
  return <details className="assign-edit"><summary>Editar datos del servicio</summary><form onSubmit={submit}>
    {field('customer_name', 'Cliente')}{field('customer_phone', 'Celular')}{field('delivery_address', 'Dirección', true)}{field('neighborhood', 'Barrio')}{field('invoice_code', 'Factura')}
    {service.payment_method !== 'none' && <label>Pago<select value={values.payment_method} onChange={event => setValues(current => ({ ...current, payment_method: event.target.value }))}><option value="cash">Efectivo</option><option value="card">Datáfono</option></select></label>}
    {field('note', 'Nota', true)}
    <button className="assign-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
  </form></details>;
}

function AssignPanel({ service, couriers, services, origin, branchByCode, onAssign, onReassign, onEdit, onCancel, workload, routeCourierId, routeStops, onToggleRoute }) {
  const [busyId, setBusyId] = useState(null);
  const [reassigning, setReassigning] = useState(false);
  const [history, setHistory] = useState([]);
  useEffect(() => setReassigning(false), [service?.id]);
  useEffect(() => {
    if (!service?.id) return undefined;
    let current = true;
    listReassignments(service.id).then(({ data, error }) => { if (current && !error) setHistory(data || []); });
    return () => { current = false; };
  }, [service?.id, service?.assigned_courier_id]);

  const roster = useMemo(() => {
    const load = {};
    services.forEach(item => {
      if (['assigned', 'enroute'].includes(item.status)) load[item.assigned_courier_id] = (load[item.assigned_courier_id] || 0) + 1;
    });
    return couriers.map(courier => ({ ...courier, load: load[courier.id] || 0, km: distanceKm(origin, pointOf(courier.last_lat, courier.last_lng)) }))
      .sort((a, b) => signalRank(a) - signalRank(b) || (a.km ?? Infinity) - (b.km ?? Infinity) || a.load - b.load);
  }, [couriers, services, origin]);

  if (!service) return <section className="ops-panel assign-panel"><div className="ops-panel-head"><div className="ops-panel-title"><h2>Asignar servicio</h2></div></div><div className="queue-empty"><Icon name="grid" size={24} /><strong>Selecciona un servicio</strong><span>La ruta y los domiciliarios aparecerán aquí.</span></div></section>;

  const canAssign = service.status === 'unassigned';
  const branch = branchByCode[startCode(service)];
  const pickup = `farmanorte ${startCode(service)}${branch?.neighborhood ? ' · ' + branch.neighborhood : ''}`;
  const delivery = service.delivery_address ? `${service.neighborhood ? service.neighborhood + ' · ' : ''}${service.delivery_address}` : destinationLabel(service);
  // Mismo orden que ve el domiciliario, también para servicios publicados antes.
  const isHome = String(service.service_type).startsWith('home');
  const stepRank = { cross: 0, buy: 1, pickup: 2 };
  const steps = (Array.isArray(service.route_plan) ? service.route_plan : [])
    .filter(step => step?.title && (service.service_type === 'change' || (isHome ? !['return-origin', 'cross-return'].includes(step.key) : step.kind !== 'pickup')))
    .sort((x, y) => (service.service_type === 'change' ? 0 : (stepRank[x.kind] ?? 3) - (stepRank[y.kind] ?? 3)));
  const distances = roster.map(item => item.km).filter(value => value != null);
  const suggestedId = service.suggested_courier_id || (canAssign ? roster.find(item => item.available === true && !item.load && item.km != null && hasFreshGps(item))?.id : null);

  const assign = async courier => {
    setBusyId(courier.id);
    try {
      if (canAssign) await onAssign(service, courier.id);
      else if (await onReassign(service, courier.id)) setReassigning(false);
    } finally {
      setBusyId(null);
    }
  };
  const open = ['assigned', 'enroute'].includes(service.status);
  const options = canAssign ? roster : roster.filter(item => item.id !== service.assigned_courier_id);
  const currentCourier = couriers.find(item => item.id === service.assigned_courier_id);

  return <section className="ops-panel assign-panel" aria-labelledby="assign-title">
    <div className="ops-panel-head"><div className="ops-panel-title"><h2 id="assign-title">{canAssign ? 'Asignar servicio' : 'Seguimiento'}</h2></div><span className="ops-panel-sub">{service.code}</span></div>
    <div className="assign-intro">
      <div className="assign-route">
        <div className="assign-route-row"><span className="assign-route-dot" aria-hidden="true" /><div className="assign-route-copy"><span>Recoge en</span><strong>{pickup}</strong></div></div>
        <div className="assign-route-row"><span className="assign-route-dot" aria-hidden="true" /><div className="assign-route-copy"><span>{service.delivery_address ? 'Entrega en' : 'Destino'}</span><strong>{delivery}</strong></div></div>
      </div>
      <div className="assign-meta"><span>{serviceLabel(service)}</span>{service.general_fee_cop != null && <strong>{money(service.general_fee_cop)}</strong>}</div>
      {service.customer_name && service.delivery_address && <div className="assign-extra"><span>Cliente</span><strong>{service.customer_name}{service.customer_phone ? ' · ' + service.customer_phone : ''}</strong></div>}
      {(service.courier_fee_cop != null) && <div className="assign-extra"><span>Pago al domiciliario</span><strong>{money(service.courier_fee_cop)}</strong></div>}
      {currentCourier && <div className="assign-extra"><span>Domiciliario</span><strong>{currentCourier.full_name}</strong></div>}
      {history.map(item => <div className="assign-extra" key={item.id}><span>Reasignado {clock(item.created_at)}</span><strong>De {couriers.find(courier => courier.id === item.payload?.previous_courier_id)?.full_name || 'otro domiciliario'}{item.payload?.reason ? ' · ' + item.payload.reason : ''}</strong></div>)}
      {service.note && <div className="assign-extra"><span>Nota de la farmacia</span><strong>{service.note}</strong></div>}
      {isHome && service.service_type !== 'home' && steps.length > 0 && !steps.some(step => step.kind === 'pickup') && <div className="assign-extra"><span>Farmacia</span><strong>No hay que volver</strong></div>}
      {steps.length > 0 && <ol className="assign-steps">{steps.map(step => <li key={step.key} className={'is-' + (step.status || 'pending')}>{step.title}{step.detail && <small>{step.detail}</small>}</li>)}</ol>}
    </div>
    {canAssign || reassigning ? <>
      <div className="assign-list-label"><span>Domiciliarios por cercanía</span>{distances.length > 0 && <span>{km(Math.min(...distances))}–{km(Math.max(...distances))}</span>}</div>
      <div className="assign-list">
        {options.map(courier => {
          const off = courier.available === false;
          const noSignal = !off && !hasFreshGps(courier);
          const suggested = courier.id === suggestedId;
          return <div key={courier.id} className={'courier-option' + (suggested ? ' is-suggested' : '')}>
            <span className={'avatar avatar--' + toneOf(courier.id)} aria-hidden="true">{initials(courier.full_name)}</span>
            <div className="courier-option-main">
              <div className="courier-option-name"><strong>{courier.full_name}</strong>{suggested && <span className="suggested-tag">Sugerido</span>}</div>
              <div className="courier-option-meta"><span className={'courier-state' + (off || noSignal || courier.load ? ' is-busy' : '')}>{off ? 'Desconectado' : noSignal ? 'Sin señal' : courier.load ? 'En servicio' : 'Libre'}</span>{courier.zone && <><span>·</span><span>{courier.zone}</span></>}{courier.km != null && <span className="courier-distance">· {km(courier.km)}{hasFreshGps(courier) ? '' : ' (ubicación antigua)'}</span>}</div>
              <div className="courier-load"><span>{loadLabel(workload[courier.id])}</span>{workload[courier.id]?.estimated_minutes >= CONGESTED_MINUTES && <span className="route-congested">Congestionado</span>}{workload[courier.id]?.open_services > 0 && <button type="button" className="courier-load-route" onClick={() => onToggleRoute(courier.id)}>{routeCourierId === courier.id ? 'Ocultar ruta' : 'Ver ruta'}</button>}</div>
              {routeCourierId === courier.id && <RouteStops stops={routeStops} />}
            </div>
            <button className="assign-button" type="button" disabled={Boolean(busyId)} onClick={() => assign(courier)}>{busyId === courier.id ? 'Guardando…' : canAssign ? 'Asignar' : 'Pasar aquí'}</button>
          </div>;
        })}
        {!options.length && <div className="queue-empty"><Icon name="users" size={24} /><strong>Sin domiciliarios activos</strong></div>}
      </div>
      <p className="assign-tip"><Icon name="bell" size={13} />Al asignar, la app del domiciliario recibe el aviso con sonido y vibración.</p>
    </> : <p className="assign-tip"><span className={'status-pill status-pill--' + service.status}>{STATUS_LABELS[service.status]}</span>El estado se actualiza desde la app del domiciliario.</p>}
    {open && <button className="assign-reassign" type="button" onClick={() => setReassigning(value => !value)}>{reassigning ? 'No reasignar' : 'Reasignar a otro domiciliario'}</button>}
    {(canAssign || open) && <ServiceEditor service={service} onSave={onEdit} />}
    {(canAssign || open) && <CancelService service={service} onCancel={onCancel} />}
  </section>;
}
