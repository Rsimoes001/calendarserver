/**
 * ============================================================================
 *  state.js
 * ----------------------------------------------------------------------------
 *  Módulo de estado global (única fuente de verdad) para compartir referencias
 *  entre módulos sin contaminar window.
 *  - calendar: instancia de FullCalendar
 *  - currentEvent: último evento abierto en el modal
 *  - lastRawEvents: caché de eventos crudos (para contadores/listados)
 *  - passwordResolver: closure de resolución del modal de contraseña
 * ============================================================================
 */

/** @type {import('@fullcalendar/core').Calendar | null} */
export let calendar = null;

/** @type {{ id: string|number|null, start: string, title: string, extendedProps: any } | null} */
export let currentEvent = null;

/** @type {Array<any>} */
export let lastRawEvents = [];

/** @type {((value: string|null)=>void) | null} */
export let passwordResolver = null;

// -- setters centralizados (evitamos reasignar variables importadas)
export function setCalendar(c)         { calendar = c; }
export function setCurrentEvent(ev)    { currentEvent = ev; }
export function setLastRawEvents(arr)  { lastRawEvents = Array.isArray(arr) ? arr : []; }
export function setPasswordResolver(f) { passwordResolver = typeof f === 'function' ? f : null; }

// Exponer mínimamente lo imprescindible para handlers inline heredados
// (p.ej. el botón ✏️ en el header del modal usa currentEvent)
window.currentEventRef = {
  get value(){ return currentEvent; },
  set value(v){ currentEvent = v; }
};
