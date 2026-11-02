import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';
import { AuthLiveStage } from './AuthLiveStage.jsx';
import './AuthScreen.css';

const MONTERIA_TIME = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'America/Bogota'
});

function useMonteriaClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  return MONTERIA_TIME.format(now);
}

export function AuthScreen({ configured, onSignIn }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState('');
  const cardRef = useRef(null);
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);
  const clock = useMonteriaClock();

  function clearError() {
    if (error) {
      setError('');
      setErrorField('');
    }
  }

  function showError(message, field) {
    setError(message);
    setErrorField(field || 'form');
    const card = cardRef.current;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (card && !reducedMotion && typeof card.animate === 'function') {
      card.animate([
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(-3px)' },
        { transform: 'translateX(2px)' },
        { transform: 'translateX(0)' }
      ], { duration: 420, easing: 'ease-in-out' });
    }
  }

  function handleIdentifierChange(event) {
    setIdentifier(event.target.value);
    clearError();
  }

  function handlePasswordChange(event) {
    setPassword(event.target.value);
    clearError();
  }

  function updateCapsLock(event) {
    if (typeof event.getModifierState === 'function') {
      setCapsLock(event.getModifierState('CapsLock'));
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (loading || !configured) return;

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      showError('Escribe tu usuario para continuar.', 'identifier');
      window.requestAnimationFrame(() => identifierRef.current?.focus());
      return;
    }
    if (password.length < 6) {
      showError('La clave debe tener al menos 6 caracteres.', 'password');
      window.requestAnimationFrame(() => passwordRef.current?.focus());
      return;
    }

    clearError();
    setLoading(true);
    try {
      const result = await onSignIn(cleanIdentifier, password);
      if (result?.error) {
        showError('No pudimos abrir la sesión. Revisa los datos o el rol de la cuenta.', 'password');
        window.requestAnimationFrame(() => passwordRef.current?.focus());
      }
    } catch (submitError) {
      showError('No pudimos conectar con la central. Intenta nuevamente.', 'form');
    } finally {
      setLoading(false);
    }
  }

  const networkLabel = configured ? 'Central en línea' : 'Configuración pendiente';

  return (
    <main className="auth2">
      <section className="auth2-cover" aria-labelledby="auth2-hero-title">
        <div className="auth2-ambient" aria-hidden="true">
          <span className="auth2-orbit auth2-orbit--wide" />
          <span className="auth2-orbit auth2-orbit--tight" />
          <span className="auth2-orb auth2-orb--one" />
          <span className="auth2-orb auth2-orb--two" />
          <span className="auth2-spark auth2-spark--one" />
          <span className="auth2-spark auth2-spark--two" />
        </div>

        <header className="auth2-brand">
          <span className="auth2-brand-mark">
            <span className="auth2-brand-orbit" aria-hidden="true" />
            <img src={`${import.meta.env.BASE_URL}assets/911-mensajeros-monteria.png`} alt="" />
          </span>
          <span className="auth2-brand-copy">
            <strong>911 Mensajeros</strong>
            <small>Central de despacho</small>
          </span>
          <span className={configured ? 'auth2-connection is-online' : 'auth2-connection is-offline'}>
            <i />{networkLabel}
          </span>
        </header>

        <div className="auth2-copy">
          <p className="auth2-kicker"><span className="auth2-kicker-rule" aria-hidden="true" />Operación en tiempo real</p>
          <h1 id="auth2-hero-title">
            La ciudad
            <br />
            <span className="auth2-title-accent">
              en movimiento.
              <span className="auth2-title-route" aria-hidden="true"><i /></span>
            </span>
          </h1>
          <p className="auth2-lead">
            Una central humana para que cada farmacia sepa que su solicitud está en buenas manos.
          </p>
        </div>

        <AuthLiveStage configured={configured} />

        <footer className="auth2-cover-foot">
          <span><Icon name="pin" size={14} />Montería, Córdoba</span>
          <span className="auth2-cover-divider" aria-hidden="true" />
          <span>farmanorte · Despacho</span>
          <span className="auth2-cover-time"><i />{clock}</span>
        </footer>
      </section>

      <section className="auth2-panel" aria-labelledby="auth2-login-title">
        <div className="auth2-panel-art" aria-hidden="true">
          <span className="auth2-panel-orbit auth2-panel-orbit--one" />
          <span className="auth2-panel-orbit auth2-panel-orbit--two" />
          <span className="auth2-panel-line" />
          <span className="auth2-panel-dot" />
        </div>

        <div className="auth2-card" ref={cardRef}>
          <div className="auth2-topline">
            <span className="auth2-access-mark" aria-hidden="true">C</span>
            <span className="auth2-access-label">Acceso de operación</span>
            <span className="auth2-secure"><Icon name="shield" size={14} />Canal seguro</span>
          </div>

          <h2 id="auth2-login-title">Bienvenido a la central</h2>
          <p className="auth2-form-lead">
            Ingresa para ver la cola, tomar decisiones y mantener el servicio en movimiento.
          </p>

          {!configured && (
            <div className="auth2-config-note" role="status">
              <Icon name="alert" size={17} />
              <span>Supabase no está configurado en este entorno. Un administrador debe completar las variables de acceso.</span>
            </div>
          )}

          <form className="auth2-form" onSubmit={submit} noValidate aria-busy={loading}>
            <div className="auth2-field">
                <label htmlFor="central-id">Usuario</label>
              <div className={errorField === 'identifier' ? 'auth2-input-shell has-error' : 'auth2-input-shell'}>
                <span className="auth2-input-icon" aria-hidden="true"><Icon name="user" size={18} /></span>
                <input
                  ref={identifierRef}
                  id="central-id"
                  value={identifier}
                  onChange={handleIdentifierChange}
                  placeholder="central.911"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={!configured || loading}
                  aria-invalid={errorField === 'identifier' || errorField === 'form'}
                  aria-describedby={error ? 'auth2-error' : undefined}
                />
              </div>
            </div>

            <div className="auth2-field">
              <div className="auth2-label-row">
                <label htmlFor="central-password">Clave</label>
                <span>Mínimo 6 caracteres</span>
              </div>
              <div className={errorField === 'password' ? 'auth2-input-shell has-error' : 'auth2-input-shell'}>
                <span className="auth2-input-icon" aria-hidden="true"><Icon name="lock" size={18} /></span>
                <input
                  ref={passwordRef}
                  id="central-password"
                  value={password}
                  onChange={handlePasswordChange}
                  onKeyDown={updateCapsLock}
                  onKeyUp={updateCapsLock}
                  onBlur={() => setCapsLock(false)}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Tu clave de operación"
                  autoComplete="current-password"
                  disabled={!configured || loading}
                  aria-invalid={errorField === 'password' || errorField === 'form'}
                  aria-describedby={error ? 'auth2-error' : undefined}
                />
                <button
                  className="auth2-password-toggle"
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
                  aria-pressed={showPassword}
                  disabled={!configured || loading}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
              {capsLock && <p className="auth2-caps"><Icon name="alert" size={13} />Bloq Mayús está activo.</p>}
            </div>

            {error && (
              <div className="auth2-error" id="auth2-error" role="alert">
                <Icon name="alert" size={17} />
                <span>{error}</span>
              </div>
            )}

            <button className="auth2-submit" type="submit" disabled={!configured || loading} aria-busy={loading}>
              {loading ? (
                <><span className="auth2-spinner" aria-hidden="true" />Abriendo central…</>
              ) : (
                <>Entrar a despacho<Icon name="arrow" size={18} /></>
              )}
            </button>
          </form>

          <div className="auth2-assurance">
            <span><Icon name="lock" size={14} />Sesión persistente para el equipo autorizado.</span>
            <span className="auth2-secure-note">Montería · {clock}</span>
          </div>
        </div>

        <footer className="auth2-panel-foot">
          <span>911 Mensajeros Montería</span>
          <span>Central de despacho</span>
          <span>v0.1</span>
        </footer>
      </section>
    </main>
  );
}
