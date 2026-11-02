// Tonos que cada usuario puede elegir, agrupados por género.
export const TONES = [
  {
    "id": "tono_firma_911",
    "label": "Firma 911",
    "genre": "Marca 911"
  },
  {
    "id": "tono_servicio_retirado",
    "label": "Servicio retirado",
    "genre": "Marca 911"
  },
  {
    "id": "tono_servicio_actualizado",
    "label": "Servicio actualizado",
    "genre": "Marca 911"
  },
  {
    "id": "tono_entrega_completada",
    "label": "Entrega completada",
    "genre": "Marca 911"
  },
  {
    "id": "tono_solicitud_entrante",
    "label": "Solicitud entrante",
    "genre": "Estilo app de transporte"
  },
  {
    "id": "tono_conductor_listo",
    "label": "Conductor listo",
    "genre": "Estilo app de transporte"
  },
  {
    "id": "tono_arranque",
    "label": "Arranque",
    "genre": "Estilo app de transporte"
  },
  {
    "id": "tono_match",
    "label": "Match",
    "genre": "Trompeta y fanfarria"
  },
  {
    "id": "tono_heraldo",
    "label": "Heraldo",
    "genre": "Trompeta y fanfarria"
  },
  {
    "id": "tono_triple_metal",
    "label": "Triple metal",
    "genre": "Trompeta y fanfarria"
  },
  {
    "id": "tono_metales_de_salsa",
    "label": "Metales de salsa",
    "genre": "Salsa y latino"
  },
  {
    "id": "tono_cumbia",
    "label": "Cumbia",
    "genre": "Salsa y latino"
  },
  {
    "id": "tono_mariachi",
    "label": "Mariachi",
    "genre": "Salsa y latino"
  },
  {
    "id": "tono_dembow",
    "label": "Dembow",
    "genre": "Urbano"
  },
  {
    "id": "tono_trap",
    "label": "Trap",
    "genre": "Urbano"
  },
  {
    "id": "tono_house",
    "label": "House",
    "genre": "Electrónica"
  },
  {
    "id": "tono_subida",
    "label": "Subida",
    "genre": "Electrónica"
  },
  {
    "id": "tono_sintetizador",
    "label": "Sintetizador",
    "genre": "Electrónica"
  },
  {
    "id": "tono_cristal",
    "label": "Cristal",
    "genre": "Digital y tecnológico"
  },
  {
    "id": "tono_pulso_digital",
    "label": "Pulso digital",
    "genre": "Digital y tecnológico"
  },
  {
    "id": "tono_pulso_ascendente",
    "label": "Pulso ascendente",
    "genre": "Digital y tecnológico"
  },
  {
    "id": "tono_moneda_propia",
    "label": "Moneda propia",
    "genre": "Retro 8 bits"
  },
  {
    "id": "tono_nivel_listo",
    "label": "Nivel listo",
    "genre": "Retro 8 bits"
  },
  {
    "id": "tono_pedido_arcade",
    "label": "Pedido arcade",
    "genre": "Retro 8 bits"
  },
  {
    "id": "tono_campana_ascendente",
    "label": "Campana ascendente",
    "genre": "Campanas"
  },
  {
    "id": "tono_recepcion",
    "label": "Recepción",
    "genre": "Campanas"
  },
  {
    "id": "tono_campanilla",
    "label": "Campanilla",
    "genre": "Campanas"
  },
  {
    "id": "tono_marimba_rapida",
    "label": "Marimba rápida",
    "genre": "Marimba y madera"
  },
  {
    "id": "tono_kalimba",
    "label": "Kalimba",
    "genre": "Marimba y madera"
  },
  {
    "id": "tono_notas_suaves",
    "label": "Notas suaves",
    "genre": "Marimba y madera"
  },
  {
    "id": "tono_guitarra",
    "label": "Guitarra",
    "genre": "Acústico"
  },
  {
    "id": "tono_rasgueo",
    "label": "Rasgueo",
    "genre": "Acústico"
  },
  {
    "id": "tono_piano_electrico",
    "label": "Piano eléctrico",
    "genre": "Jazz"
  },
  {
    "id": "tono_trompeta_con_sordina",
    "label": "Trompeta con sordina",
    "genre": "Jazz"
  },
  {
    "id": "tono_cuerdas",
    "label": "Cuerdas",
    "genre": "Orquestal"
  },
  {
    "id": "tono_pizzicato",
    "label": "Pizzicato",
    "genre": "Orquestal"
  },
  {
    "id": "tono_timbal_y_metales",
    "label": "Timbal y metales",
    "genre": "Orquestal"
  },
  {
    "id": "tono_congas",
    "label": "Congas",
    "genre": "Percusión"
  },
  {
    "id": "tono_claves",
    "label": "Claves",
    "genre": "Percusión"
  },
  {
    "id": "tono_timbre_urgente",
    "label": "Timbre urgente",
    "genre": "Alarma y urgente"
  },
  {
    "id": "tono_sirena_corta",
    "label": "Sirena corta",
    "genre": "Alarma y urgente"
  },
  {
    "id": "tono_alerta_doble",
    "label": "Alerta doble",
    "genre": "Alarma y urgente"
  }
];

export const CENTRAL_ALERTS = [
  { key: 'new', label: 'Nuevo pedido', fallback: 'tono_firma_911' },
  { key: 'delivered', label: 'Entrega completada', fallback: 'tono_entrega_completada' },
  { key: 'urgent', label: 'Más de 10 minutos sin asignar', fallback: 'tono_alerta_doble' }
];

const storageKey = key => `central_tone_${key}`;

export function toneFor(key) {
  const fallback = CENTRAL_ALERTS.find(item => item.key === key).fallback;
  try {
    const saved = localStorage.getItem(storageKey(key));
    return TONES.some(tone => tone.id === saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function saveTone(key, id) {
  try { localStorage.setItem(storageKey(key), id); } catch { /* solo dura esta sesión */ }
}

export function toneUrl(id) {
  return `${import.meta.env.BASE_URL}assets/${id}.wav`;
}
