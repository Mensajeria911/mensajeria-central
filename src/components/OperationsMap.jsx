import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// MapLibre 6 busca su worker junto al bundle y Vite no lo copia: se lo indicamos.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

const MONTERIA_CENTER = [-75.88, 8.756];

// OpenFreeMap entrega un estilo vectorial listo para MapLibre sin token.
// El estilo se puede reemplazar en producción mediante VITE_MAP_STYLE_URL.
const fallbackStyle = 'https://tiles.openfreemap.org/styles/positron';

function coordinate(value) {
  // Number(null) es 0: sin este filtro una sede sin ubicar caería en el océano.
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function pointOf(latitude, longitude) {
  const lat = coordinate(latitude);
  const lng = coordinate(longitude);
  return lat == null || lng == null ? null : [lng, lat];
}

// Un GPS de prueba o erróneo (por ejemplo un emulador) no debe alejar el mapa de la ciudad.
function inMonteria([lng, lat]) {
  return lat >= 8.6 && lat <= 8.9 && lng >= -76 && lng <= -75.7;
}

function courierFreshness(timestamp) {
  const time = timestamp ? new Date(timestamp).getTime() : NaN;
  if (!Number.isFinite(time)) return { label: 'Sin señal', kind: 'stale' };
  const age = Math.max(0, Date.now() - time) / 1000;
  if (age <= 120) return { label: 'En vivo', kind: 'live' };
  if (age <= 300) return { label: 'Hace unos minutos', kind: 'warm' };
  return { label: 'Ubicación antigua', kind: 'stale' };
}

const MOTO_ICON = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="16.5" r="3.2"/><circle cx="18.5" cy="16.5" r="3.2"/><path d="M5.5 16.5h6l3.5-6.5h-5M15 10l3.5 6.5M13.5 6.5h3l-1.5 3.5"/></svg>';
const PIN_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>';

function markerElement(kind, label, selected) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `operations-marker operations-marker--${kind}${selected ? ' is-selected' : ''}`;
  element.setAttribute('aria-label', label);
  const icon = document.createElement('span');
  icon.className = 'operations-marker-icon';
  if (kind === 'branch') {
    const logo = document.createElement('img');
    logo.src = `${import.meta.env.BASE_URL}assets/farmanortedromedicas_logo.jpg`;
    logo.alt = '';
    icon.append(logo);
  } else {
    icon.innerHTML = kind === 'destination' ? PIN_ICON : MOTO_ICON;
  }
  const text = document.createElement('span');
  text.className = 'operations-marker-label';
  text.textContent = label;
  element.append(icon, text);
  return element;
}

// Sedes donde hay que recoger cruces: salen de la ruta y, si no hay, del servicio.
function crossSources(service) {
  if (!service) return [];
  const route = Array.isArray(service.route_plan) ? service.route_plan : [];
  const codes = route.filter(step => step?.kind === 'cross' && step.source_branch_code).map(step => String(step.source_branch_code));
  if (!codes.length && service.cross_branch_code) codes.push(String(service.cross_branch_code));
  return [...new Set(codes)];
}

function arrowImage() {
  const size = 22;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#0b3fa0';
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(4, 3);
  context.lineTo(19, 11);
  context.lineTo(4, 19);
  context.closePath();
  context.stroke();
  context.fill();
  return context.getImageData(0, 0, size, size);
}

function popupContent(title, lines) {
  const wrapper = document.createElement('div');
  wrapper.className = 'operations-popup';
  const heading = document.createElement('strong');
  heading.textContent = title;
  wrapper.append(heading);
  lines.filter(Boolean).forEach(line => {
    const row = document.createElement('span');
    row.textContent = line;
    wrapper.append(row);
  });
  return wrapper;
}

export function OperationsMap({ branches = [], couriers = [], services = [], selected = null, routeCourierId = null, routeStops = [] }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const hasFitRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: import.meta.env.VITE_MAP_STYLE_URL || fallbackStyle,
      center: MONTERIA_CENTER,
      zoom: 12.2,
      attributionControl: false,
      cooperativeGestures: true
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    let loaded = false;
    const loadTimeout = window.setTimeout(() => {
      if (!loaded) setMapError('No se pudo cargar el mapa base. Revisa la conexión.');
    }, 10000);
    map.on('load', () => {
      loaded = true;
      window.clearTimeout(loadTimeout);
      setMapError('');
      setReady(true);
    });
    const syncZoom = () => containerRef.current?.classList.toggle('operations-map--far', map.getZoom() < 14);
    map.on('zoom', syncZoom);
    syncZoom();
    map.on('error', event => {
      // Un error puntual de una tesela no debe cubrir el mapa ni detener la operación.
      if (event?.error?.message) console.warn('MapLibre:', event.error.message);
    });
    mapRef.current = map;
    return () => {
      window.clearTimeout(loadTimeout);
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return undefined;
    const map = mapRef.current;
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    const bounds = new maplibregl.LngLatBounds();
    let pointCount = 0;

    const addMarker = ({ kind, coordinates, title, lines, isSelected = false }) => {
      if (!coordinates) return;
      const marker = new maplibregl.Marker({
        element: markerElement(kind, title, isSelected),
        anchor: 'bottom'
      }).setLngLat(coordinates).setPopup(new maplibregl.Popup({ offset: 16, closeButton: true }).setDOMContent(popupContent(title, lines))).addTo(map);
      markersRef.current.push(marker);
      if (!inMonteria(coordinates)) return;
      bounds.extend(coordinates);
      pointCount += 1;
    };

    branches.filter(branch => branch.active !== false).forEach(branch => addMarker({
      kind: 'branch',
      coordinates: pointOf(branch.latitude, branch.longitude),
      title: branch.code ? `FN ${String(branch.code).replace(/^FN\s*/i, '')}` : 'Farmacia',
      isSelected: selected?.branch_code === branch.code || crossSources(selected).includes(String(branch.code)),
      lines: [branch.name, branch.address, branch.neighborhood].filter(Boolean)
    }));

    const activeCourierIds = new Set(services.filter(service => ['assigned', 'enroute'].includes(service.status)).map(service => service.assigned_courier_id));

    couriers.filter(courier => courier.active !== false).forEach(courier => {
      const freshness = courierFreshness(courier.last_location_at);
      const coordinates = pointOf(courier.last_lat, courier.last_lng);
      addMarker({
        kind: freshness.kind === 'stale' ? 'courier-stale' : courier.available === false || activeCourierIds.has(courier.id) ? 'courier-busy' : 'courier',
        coordinates,
        title: courier.full_name || courier.username || 'Domiciliario',
        lines: [activeCourierIds.has(courier.id) ? 'En servicio' : courier.available === false ? 'Desconectado' : freshness.kind === 'stale' ? 'Sin señal' : 'Libre', freshness.label, courier.zone ? `Zona: ${courier.zone}` : null, courier.last_location_at ? `Actualizado: ${new Date(courier.last_location_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : null]
      });
    });

    services.filter(service => ['assigned', 'enroute'].includes(service.status) || service.id === selected?.id).forEach(service => addMarker({
      kind: 'destination',
      coordinates: pointOf(service.destination_lat, service.destination_lng),
      title: service.code || 'Destino',
      lines: [service.delivery_address, service.customer_name, service.status === 'enroute' ? 'En camino' : 'Asignado'].filter(Boolean)
    }));

    routeStops.forEach(stop => addMarker({
      kind: 'destination',
      coordinates: pointOf(stop.stop_lat, stop.stop_lng),
      title: `${stop.stop_no}. ${stop.service_code}`,
      lines: [stop.stop_title]
    }));

    if (!hasFitRef.current && pointCount > 0 && !bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 52, maxZoom: 14.2, duration: 0 });
      hasFitRef.current = true;
    }
    return undefined;
  }, [branches, couriers, services, selected?.id, selected?.branch_code, routeStops, ready]);

  // Ruta del servicio elegido: de la sede al punto de entrega.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const pointOfBranch = code => {
      const branch = branches.find(item => String(item.code) === String(code));
      return branch ? pointOf(branch.latitude, branch.longitude) : null;
    };
    const hub = selected ? pointOfBranch(selected.branch_code) : null;
    const to = selected?.service_type !== 'cross' && selected ? pointOf(selected.destination_lat, selected.destination_lng) : null;
    // Cada cruce va de la sede que lo tiene a la que lo pidió; luego, de ahí al cliente.
    const segments = crossSources(selected).map(pointOfBranch).filter(from => from && hub).map(from => [from, hub]);
    if (hub && to) segments.push([hub, to]);
    const data = { type: 'FeatureCollection', features: segments.map(coordinates => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })) };
    if (map.getSource('ruta-servicio')) map.getSource('ruta-servicio').setData(data);
    else {
      if (!map.hasImage('flecha-ruta')) map.addImage('flecha-ruta', arrowImage());
      map.addSource('ruta-servicio', { type: 'geojson', data });
      map.addLayer({ id: 'ruta-servicio', type: 'line', source: 'ruta-servicio', paint: { 'line-color': '#0b3fa0', 'line-width': 3, 'line-dasharray': [1.5, 1.5] } });
      map.addLayer({ id: 'ruta-servicio-flechas', type: 'symbol', source: 'ruta-servicio', layout: { 'symbol-placement': 'line', 'symbol-spacing': 110, 'icon-image': 'flecha-ruta', 'icon-size': .8, 'icon-allow-overlap': true, 'icon-rotation-alignment': 'map' } });
    }
    if (segments.length) {
      const bounds = new maplibregl.LngLatBounds(segments[0][0], segments[0][0]);
      segments.flat().forEach(point => bounds.extend(point));
      map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 500 });
    } else if (hub) map.easeTo({ center: hub, zoom: Math.max(map.getZoom(), 13.5), duration: 500 });
  }, [selected?.id, branches, ready]);

  // Ruta del domiciliario elegido: de donde está a cada parada, en orden.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const courier = couriers.find(item => item.id === routeCourierId);
    const start = courier ? pointOf(courier.last_lat, courier.last_lng) : null;
    const points = [start, ...routeStops.map(stop => pointOf(stop.stop_lat, stop.stop_lng))].filter(Boolean);
    const data = { type: 'FeatureCollection', features: points.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points } }] : [] };
    if (map.getSource('ruta-domiciliario')) map.getSource('ruta-domiciliario').setData(data);
    else {
      map.addSource('ruta-domiciliario', { type: 'geojson', data });
      map.addLayer({ id: 'ruta-domiciliario', type: 'line', source: 'ruta-domiciliario', paint: { 'line-color': '#c2570c', 'line-width': 4 } });
    }
  }, [routeCourierId, routeStops, couriers, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current || !routeCourierId || !routeStops.length) return;
    const courier = couriers.find(item => item.id === routeCourierId);
    const points = [courier ? pointOf(courier.last_lat, courier.last_lng) : null, ...routeStops.map(stop => pointOf(stop.stop_lat, stop.stop_lng))].filter(Boolean);
    if (!points.length) return;
    const bounds = new maplibregl.LngLatBounds(points[0], points[0]);
    points.forEach(point => bounds.extend(point));
    mapRef.current.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 500 });
    // Solo al elegir otro domiciliario o cuando cambian sus paradas, no con cada GPS.
  }, [routeCourierId, routeStops, ready]);

  const branchCount = branches.filter(branch => branch.active !== false && pointOf(branch.latitude, branch.longitude)).length;
  const courierCount = couriers.filter(courier => courier.active !== false && pointOf(courier.last_lat, courier.last_lng)).length;

  return <div className="operations-map">
    <div ref={containerRef} className="operations-map-canvas" aria-label="Mapa de farmacias y domiciliarios" />
    {!ready && !mapError && <div className="operations-map-state"><span className="map-loading-dot" /><strong>Cargando mapa…</strong></div>}
    {mapError && <div className="operations-map-state operations-map-state--error"><strong>{mapError}</strong><span>La operación continuará mostrando la información de la lista.</span></div>}
    {ready && branchCount === 0 && courierCount === 0 && !mapError && <div className="operations-map-state"><strong>Sin coordenadas confirmadas</strong><span>Confirma la ubicación de las sedes y activa el GPS de los domiciliarios.</span></div>}
  </div>;
}
