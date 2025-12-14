/**
 * ============================================================================
 *  utils.js
 * ----------------------------------------------------------------------------
 *  Funciones puras y catálogos (sin efectos secundarios):
 *   - Normalización/esape/formatos
 *   - Catálogos (Tipos, Marcas, Modelos, Obradores)
 *   - Selects encadenados (fillSelect/getBrands/getModels)
 *   - Zonas y Partidos
 *   - Horarios (parse/format)
 *   - UNC -> file:// URL
 * ============================================================================
 */

// ============================= Catálogos =============================
export const CATALOG = {
  RECONECTADOR: {
    ABB: ['OVR3', 'OVR15'],
    ENTEC: ['ETR300-R-600'],
    COOPER: ['FORM6'],
    TAVRIDA: ['RC5_4'],
    'SIN DATOS': ['SIN DATOS'],
  },
  SECCIONALIZADOR: {
    ABB: ['POL1', 'POL2', 'CHINO', 'WiAutoLink'],
    ENTEC: ['ETMFC610', 'ETMFC101-N1'],
    EFACEC: ['R650'],
    SCHNEIDER: ['T200P'],
    'SIN DATOS': ['SIN DATOS'],
  },
  INTERRUPTOR: {
    'MERLIN GERIN': ['VIP 13', 'VIP 201', 'VIP 300LL'],
    FANOX: ['SIA-C'],
    WOODWARD: ['WIP1-1'],
    SCHNEIDER: ['VIP 400', 'MiCOM P116'],
    ABB: ['VC'],
    'SIN DATOS': ['SIN DATOS'],
  },
};

export const TYPE_OPTIONS   = ['INTERRUPTOR', 'RECONECTADOR', 'SECCIONALIZADOR', 'SBC'];
export const OBRADOR_OPTIONS = ['CDSJ','CDME','CDGC','CDLH','CDMO','CDMR','ROWING_MR','ROWING_ITU','ROWING_TI','BEPANOR','SADE_ITU','POSE'];
export const ESTADO_OPTIONS  = ['PROGRAMADO', 'EJECUTADO', 'REPROGRAMADO', 'SUSPENDIDO'];

// Zonas y Partidos (mismo dataset que en tu main.js)
export const ZONAS = {
  '1CA': ['CAPITAL FEDERAL', 'VICENTE LOPEZ'],
  '1MA': ['GRAL SAN MARTIN', '3 DE FEBRERO'],
  '1OL': ['SAN ISIDRO', 'VICENTE LOPEZ'],
  '2LM': ['LA MATANZA'],
  '2ME': ['GRAL LAS HERAS', 'MERLO', 'MARCOS PAZ'],
  '2MO': ['HURLINGHAM', 'MORON', 'ITUZAINGO'],
  '3MI': ['JOSE C PAZ', 'MALVINAS ARGENTINAS', 'SAN MIGUEL'],
  '3MR': ['MORENO', 'GRAL RODRIGUEZ', 'JOSE C PAZ'],
  '3PI': ['ESCOBAR', 'PILAR'],
  '3TI': ['SAN FERNANDO', 'TIGRE'],
};
export const getZonas = () => Object.keys(ZONAS);
export const getPartidosByZona = (zonaCode='') => ZONAS[zonaCode] || [];

// ============================= Helpers puros =============================
export const normalize = (s) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

export const esc = (s='') =>
  String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

export const typeToCatalogKey = (t='') =>
  (t.toUpperCase() === 'SBC' ? 'SECCIONALIZADOR' : t.toUpperCase());

export const getBrands = (tipo) => Object.keys(CATALOG[typeToCatalogKey(tipo)] || {});
export const getModels = (tipo, marca) => (CATALOG[typeToCatalogKey(tipo)] || {})[marca] || [];

export const fillSelect = (sel, options = [], current = '') => {
  const set = new Set(options);
  sel.innerHTML = options.map(o => `<option>${o}</option>`).join('');
  if (current && set.has(current)) sel.value = current;
  else if (options.length) sel.value = options[0];
};

// ============================= Horarios =============================
export const parseHorario = (v='') => {
  const s = String(v).trim();
  const none = !s || /sin\s*horario/i.test(s);
  const m = s.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!m || none) return { start: '', end: '', none: true };
  const pad = (x) => String(x).padStart(2, '0');
  return { start: `${pad(m[1])}:${m[2]}`, end: `${pad(m[3])}:${m[4]}`, none: false };
};
export const formatHorario = ({ start='', end='', none=false }) => {
  if (none) return 'SIN HORARIO';
  if (start && end) return `${start}-${end}`;
  return '';
};

// Fecha dd/mm/aaaa desde ISO
export const formatDateISO = (iso='') => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// ============================= Rutas UNC =============================
export function uncToFileURL(unc) {
  const s = String(unc).trim();
  // C:\carpeta -> file:///C:/carpeta
  if (/^[a-zA-Z]:[\\/]/.test(s)) return 'file:///' + s.replace(/\\/g, '/');
  // \\server\share\carpeta -> file://server/share/carpeta
  const clean = s.replace(/^\\\\+/, '').replace(/\\/g, '/');
  return 'file://' + clean; // corrección respecto a file://// en versión previa
}
