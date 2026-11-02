export function Icon({ name, size = 19 }) {
  const paths = {
    arrow: <><path d="M4 10h14" /><path d="m12 4 6 6-6 6" /></>,
    trend: <><path d="m4 17 6-6 4 4 6-7" /><path d="M15 8h5v5" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 6.5-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    inbox: <><path d="M4 5h16v14H4z" /><path d="M4 14h4l1.5 2h5L16 14h4" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    eye: <><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.7" /></>,
    eyeOff: <><path d="m3 3 18 18" /><path d="M10.6 6.2A10.6 10.6 0 0 1 12 6c6.1 0 9.5 6 9.5 6a17 17 0 0 1-3.6 4.1M6.3 6.4C3.9 8 2.5 12 2.5 12s3.4 6 9.5 6a10 10 0 0 0 4.2-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></>,
    user: <><circle cx="12" cy="8" r="3.4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    route: <><path d="M4 18c5.5 0 4.6-12 10-12h5" /><path d="m16 3 3 3-3 3" /><circle cx="4" cy="18" r="2" /></>,
    alert: <><path d="M10.3 3.8 2.1 17.9A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-3.1L13.7 3.8a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
    logout: <><path d="M10 5H5v14h5" /><path d="M13 8l4 4-4 4M8 12h9" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    package: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="M4.5 7.7 12 12l7.5-4.3M12 12v9" /></>,
    pin: <><path d="M12 21s6-5.2 6-11A6 6 0 1 0 6 10c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M19 12a7 7 0 1 1-2-5" /></>,
    receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" /><path d="M8 8h8M8 12h8M8 16h4" /></>,
    settings: <><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5" /><circle cx="12" cy="12" r="4" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 11a3 3 0 1 0 0-6M17 14a5 5 0 0 1 4 5" /></>,
    wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H20v14H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" /><path d="M4 8h16" /><circle cx="16.5" cy="12.5" r="1" /></>
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
