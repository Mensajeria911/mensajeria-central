import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';

const ROUTE = 'M 86 190 C 178 194 196 108 298 122 S 476 152 548 74';
const PHASES = [
  { icon: 'bell', eyebrow: 'La farmacia publica', title: 'Nueva solicitud', badge: 'En cola', tone: 'pending' },
  { icon: 'route', eyebrow: 'La central organiza', title: 'Ruta asignada', badge: 'Asignada', tone: 'assigned' },
  { icon: 'pin', eyebrow: 'El domiciliario avanza', title: 'En camino', badge: 'En vivo', tone: 'live' }
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  ));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    if (query.addEventListener) query.addEventListener('change', update);
    else query.addListener(update);
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', update);
      else query.removeListener(update);
    };
  }, []);
  return reduced;
}

export function AuthLiveStage({ configured }) {
  const reducedMotion = useReducedMotion();
  const [phaseIndex, setPhaseIndex] = useState(2);
  const routeRef = useRef(null);
  const courierRef = useRef(null);

  useEffect(() => {
    if (reducedMotion) {
      setPhaseIndex(2);
      return undefined;
    }
    const timer = window.setInterval(() => {
      setPhaseIndex(index => (index + 1) % PHASES.length);
    }, 3800);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  useEffect(() => {
    const path = routeRef.current;
    const marker = courierRef.current;
    if (!path || !marker || typeof path.getTotalLength !== 'function') return undefined;

    const length = path.getTotalLength();
    const positionAt = progress => {
      const distance = length * Math.min(1, Math.max(0, progress));
      const point = path.getPointAtLength(distance);
      const ahead = path.getPointAtLength(Math.min(length, distance + 1));
      const behind = path.getPointAtLength(Math.max(0, distance - 1));
      const angle = Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180 / Math.PI;
      marker.setAttribute('transform', 'translate(' + point.x.toFixed(2) + ' ' + point.y.toFixed(2) + ') rotate(' + angle.toFixed(2) + ')');
    };

    if (reducedMotion) {
      positionAt(.45);
      return undefined;
    }

    let frame = 0;
    const duration = 8000;
    const started = performance.now();
    const tick = now => {
      positionAt(((now - started) % duration) / duration);
      frame = window.requestAnimationFrame(tick);
    };
    positionAt(0);
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion]);

  const phase = PHASES[phaseIndex];

  return (
    <div className="auth-stage" aria-hidden="true">
      <div className="auth-stage-bar">
        <span className="auth-stage-live"><i />Ruta de despacho</span>
        <span className="auth-stage-place">Montería · Colombia</span>
      </div>

      <div className="auth-stage-map">
        <svg className="auth-stage-svg" viewBox="0 0 640 250" fill="none" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="courier-shadow" x="-80%" y="-80%" width="260%" height="260%">
              <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#00112f" floodOpacity=".6" />
            </filter>
          </defs>

          <g className="auth-map-grid">
            <path d="M0 47h640M0 104h640M0 161h640M0 218h640" />
            <path d="M62 0v250M152 0v250M242 0v250M332 0v250M422 0v250M512 0v250M602 0v250" />
            <path d="M0 223 117 104M187 250 320 116M390 250 505 134M585 250 640 196" />
          </g>

          <g className="auth-map-blocks">
            <rect x="86" y="62" width="76" height="29" rx="8" />
            <rect x="188" y="183" width="94" height="31" rx="8" />
            <rect x="334" y="44" width="82" height="31" rx="8" />
            <rect x="451" y="178" width="92" height="29" rx="8" />
          </g>

          <path className="auth-map-river" d="M-24 259c74-3 89-47 165-55s92 34 170 14 128-56 207-38 88 26 146 7" />
          <path className="auth-map-river-line" d="M-24 259c74-3 89-47 165-55s92 34 170 14 128-56 207-38 88 26 146 7" />
          <text className="auth-map-label auth-map-label--water" x="474" y="231">Río Sinú</text>

          <path className="auth-route-glow" d={ROUTE} />
          <path ref={routeRef} className="auth-route-base" d={ROUTE} />
          <path className="auth-route-flow" d={ROUTE} />

          <g className="auth-map-stop" transform="translate(86 190)">
            <circle className="auth-node-pulse" r="20" />
            <circle className="auth-node-halo" r="13" />
            <circle className="auth-node-core" r="5" />
            <path d="M-4 0h8M0-4v8" />
            <text x="0" y="32" textAnchor="middle">farmanorte</text>
          </g>

          <g className="auth-map-stop auth-map-stop--center" transform="translate(298 122)">
            <circle className="auth-node-pulse" r="14" />
            <circle className="auth-node-halo" r="8" />
            <circle className="auth-node-core" r="3" />
          </g>

          <g className="auth-map-stop auth-map-stop--destination" transform="translate(548 74)">
            <circle className="auth-node-pulse" r="20" />
            <circle className="auth-node-halo" r="13" />
            <path className="auth-pin-shape" d="M0-8c5.6 0 10 4.3 10 9.7C10 8 0 19 0 19S-10 8-10 1.7C-10-3.7-5.6-8 0-8Z" />
            <circle className="auth-pin-dot" cy="1.6" r="2.7" />
            <text x="0" y="35" textAnchor="middle">Cliente</text>
          </g>

          <g ref={courierRef} className="auth-route-courier" filter="url(#courier-shadow)">
            <circle className="auth-courier-glow" r="18" />
            <circle className="auth-courier-ring" r="12" />
            <path className="auth-courier-arrow" d="M-3.6 5 5 0l-8.6-5v3.7l4.8 1.3-4.8 1.3V5Z" />
          </g>
        </svg>
      </div>

      <div className="auth-stage-status" key={phaseIndex} data-tone={phase.tone}>
        <span className="auth-stage-status-icon"><Icon name={phase.icon} size={17} /></span>
        <span className="auth-stage-status-copy"><small>{phase.eyebrow}</small><strong>{phase.title}</strong></span>
        <span className={'auth-stage-badge auth-stage-badge--' + phase.tone}><i />{phase.badge}</span>
      </div>

      <div className="auth-stage-foot">
        <span className={configured ? 'auth-stage-state is-online' : 'auth-stage-state is-offline'}><i />{configured ? 'Central conectada' : 'Configuración pendiente'}</span>
        <span className="auth-stage-hint">Publica <b>→</b> Asigna <b>→</b> Entrega</span>
      </div>
    </div>
  );
}
