/**
 * ============================================================================
 *  api.js
 * ----------------------------------------------------------------------------
 *  Capa de acceso a API (fetch centralizado).
 *  Los endpoints están definidos en tu backend Flask (sin cambios).
 *  - GET  /api/tareas, /api/ausencias, /api/feriados
 *  - POST /api/update_fecha, /api/editar_tarea, /api/crear_tarea
 *  - GET  /api/ubicacion_lookup?ut=&tipo=
 *  - GET  /api/cromo?lado=
 * ============================================================================
 */

const asJson = async (res) => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const getTareas    = () => fetch('/api/tareas').then(asJson);
export const getAusencias = () => fetch('/api/ausencias').then(asJson);
export const getFeriados  = () => fetch('/api/feriados').then(asJson);

export const postUpdateFecha = (payload) =>
  fetch('/api/update_fecha', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  }).then(asJson);

export const postCrearTarea = (payload) =>
  fetch('/api/crear_tarea', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  }).then(asJson);

export const postEditarTarea = (payload) =>
  fetch('/api/editar_tarea', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  }).then(asJson);

export const ubicacionLookup = (ut, tipo) =>
  fetch(`/api/ubicacion_lookup?ut=${encodeURIComponent(ut)}&tipo=${encodeURIComponent(tipo)}`).then(asJson);

export const fetchCromo = (lado) =>
  fetch(`/api/cromo?lado=${encodeURIComponent(lado)}`).then(asJson);
