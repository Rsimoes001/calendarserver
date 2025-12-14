/**
 * ============================================================================
 *  calendar.js
 * ----------------------------------------------------------------------------
 *  Configuración y wiring de FullCalendar:
 *   - eventSources (tareas/ausencias/feriados)
 *   - filtros por tipo + búsqueda por UT/Ajuste
 *   - eventClick → abre modal de lectura
 *   - eventDrop  → mover fecha con contraseña
 * ============================================================================
 */

import { setCalendar, setLastRawEvents } from './state.js';
import { askPassword } from './password.js';
import { postUpdateFecha } from './api.js';
import { updateEnsayoCounter } from './counters.js';
import { showEditableModal } from './modals.js';

function normalize(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

function isAllowedByFilters(tipoTexto) {
  const tipo = normalize(tipoTexto);
  for (const chk of document.querySelectorAll('.filtro-tarea')) {
    if (!chk.checked) continue;
    const val = normalize(chk.value);
    if (tipo.includes(val) || val.includes(tipo)) return true;
  }
  return false;
}

function searchAndGoto(calendar) {
  const value = (document.getElementById('search-input')?.value || '').toLowerCase();
  if (!value) return;
  const events = calendar.getEvents();
  for (const ev of events) {
    const ut = (ev.extendedProps.ut || '').toLowerCase();
    const ajuste = (ev.extendedProps.ajuste || '').toLowerCase();
    if (ut.includes(value) || ajuste.includes(value)) {
      calendar.gotoDate(ev.startStr);
      return;
    }
  }
  // (sin alert para evitar ruido al tipear)
}

export function initCalendar() {
  const calendarEl = document.getElementById('calendar');
  const cal = new FullCalendar.Calendar(calendarEl, {
    locale: 'es',
    initialView: 'dayGridMonth',
    firstDay: 1,
    eventOrder: 'order',
    height: 'auto',
    contentHeight: 'auto',
    expandRows: true,
    handleWindowResize: true,

    headerToolbar: {
      left: '',
      center: '',        // vacío → sin título
      right: 'today prev,next'          // podés dejar vacío o poner botones extra
    },

    // Doble click en día → crear (reutiliza el modal en modo edición)
    dayCellDidMount: (info) => {
      info.el.addEventListener('dblclick', () => {
        const y = info.date.getFullYear();
        const m = String(info.date.getMonth() + 1).padStart(2, '0');
        const d = String(info.date.getDate()).padStart(2, '0');
        // Prepara un "evento" vacío con solo fecha y abre en edición
        const data = { id: null, start: `${y}-${m}-${d}`, title: 'ENSAYO', extendedProps: {} };
        window.currentEventRef.value = data;
        showEditableModal(data, true);
      });
    },

    eventsSet: () => updateEnsayoCounter(),
    datesSet:  () => {
      updateEnsayoCounter();
      syncYearMonthPickers(cal);  // sincroniza año y mes
    },

    eventSources: [
      { url: '/api/ausencias', failure: () => alert('Error al cargar ausencias') },
      {
        url: '/api/tareas',
        failure: () => alert('Error al cargar tareas'),
        success: (events) => {
          setLastRawEvents(events);
          const query = (document.getElementById('search-input')?.value || '').toLowerCase();
          return events.filter((ev) => {
            const allowed = isAllowedByFilters(ev.title || '');
            const ut = (ev.extendedProps.ut || '').toLowerCase();
            const ajuste = (ev.extendedProps.ajuste || '').toLowerCase();
            const match = !query || ut.includes(query) || ajuste.includes(query);
            return allowed && match;
          });
        }
      },
      { url: '/api/feriados', failure: () => alert('Error al cargar feriados') }
    ],

    editable: true,

    eventDrop: async (info) => {
      const newDate = info.event.startStr;
      if (info.event.classNames.includes('evento-ausente')) {
        alert('⚠️ No se puede mover una ausencia.');
        info.revert();
        return;
      }
      const [y, m, d] = newDate.split('-');
      const formatted = `${d}.${m}.${y}`;
      const password = await askPassword(`Ingrese la contraseña para mover la tarea al ${formatted}:`);
      if (!password) { info.revert(); return; }

      postUpdateFecha({ id: info.event.id, fecha: newDate, clave: password })
        .then((data) => {
          if (!data.success) {
            alert(`❌ ${data.message || 'Error al actualizar la fecha.'}`);
            info.revert();
          }
        })
        .catch(() => {
          alert('❌ Error de conexión con el servidor.');
          info.revert();
        });
    },

    buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', list: 'Lista' },

    eventClick: (info) => {
      if (info.event.display === 'background' || info.event.classNames.includes('evento-ausente')) return;
      const data = {
        id: info.event.id,
        start: info.event.startStr,
        title: info.event.title,
        extendedProps: info.event.extendedProps
      };
      // Dejo currentEvent accesible a los handlers inline existentes (✏️)
      window.currentEventRef.value = data;
      showEditableModal(data, false);
    },

    // Render dentro de cada event (similar a tu versión)
    eventContent: (arg) => {
      if (arg.event.display === 'background') return null;
      if (arg.event.classNames.includes('evento-ausente')) {
        return { html: `<div class="event-text"><b>${arg.event.title || 'Ausente'}</b></div>` };
      }
      const props = arg.event.extendedProps || {};
      const title = arg.event.title || 'Sin título';
      const ut    = props.ut ? ` - ${props.ut}` : '';
      const marca = (props.marca || '').trim();
      const modelo= (props.modelo || '').trim();
      const horario = (props.horario || '').trim();
      const state = (props.estado || '').toUpperCase();
      const icon = state === 'EJECUTADO' ? '✅ ' : (state === 'SUSPENDIDO' ? '❌ ' : '');
      return {
        html: `
          <div class="event-text">
            <b>${icon}${title}${ut}</b><br>
            <small>${marca}${marca && modelo ? ' - ' : ''}${modelo}</small><br>
            ${horario && horario !== '-' && horario !== 'SIN HORARIO' ? `<small>⏰ ${horario}</small>` : ''}
          </div>
        `
      };
    },

    // Texto de feriados sobre background events
    eventDidMount: (info) => {
      if (info.event.display === 'background') {
        const node = document.createElement('div');
        node.innerText = info.event.title;
        Object.assign(node.style, {
          position: 'absolute', top: '4px', left: '4px', right: '28px',
          fontSize: '12px', fontWeight: 'bold', color: '#ffffff',
          textAlign: 'left', lineHeight: '1.2', zIndex: '2',
          whiteSpace: 'normal', wordBreak: 'break-word'
        });
        info.el.appendChild(node);
      }
    }
  });

  cal.render();
  installYearMonthPickers(cal);
  setCalendar(cal);

  // Wiring de UI superiores
  document.getElementById('refresh-btn')?.addEventListener('click', () => cal.refetchEvents());

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      cal.refetchEvents();
      setTimeout(() => searchAndGoto(cal), 120);
    });
  }

  document.querySelectorAll('.filtro-tarea').forEach((chk) => {
    chk.addEventListener('change', () => cal.refetchEvents());
  });
}

// === crea/actualiza los selectores de año y mes ===
function installYearMonthPickers(calendar) {
  // Contenedor del toolbar (el del calendario renderizado)
  const tb = document.querySelector('#calendar .fc-toolbar');

  if (!tb) return;

  // El toolbar trae 3 chunks: left / center / right. Usamos el del centro.
  const chunks = tb.querySelectorAll('.fc-toolbar-chunk');
  const centerChunk = chunks[1] || tb; // fallback al toolbar si no existiera

  // Evitar duplicados
  if (centerChunk.querySelector('#fc-year-select') ||
      centerChunk.querySelector('#fc-month-select')) return;

  // --- selector de año ---
  const selYear = document.createElement('select');
  selYear.id = 'fc-year-select';
  selYear.className = 'fc-year-select';

  const nowY = new Date().getFullYear();
  for (let y = nowY - 5; y <= nowY + 5; y++) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = y;
    selYear.appendChild(opt);
  }

  // --- selector de mes ---
  const selMonth = document.createElement('select');
  selMonth.id = 'fc-month-select';
  selMonth.className = 'fc-month-select';

  const monthNames = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];
  monthNames.forEach((name, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx); // 0..11
    opt.textContent = name;
    selMonth.appendChild(opt);
  });

  // valores iniciales
  const cur = calendar.getDate();
  selYear.value  = String(cur.getFullYear());
  selMonth.value = String(cur.getMonth());

  // listeners
  function gotoYM() {
    const y = parseInt(selYear.value, 10);
    const m = parseInt(selMonth.value, 10);
    calendar.gotoDate(new Date(y, m, 1));
  }
  selYear.addEventListener('change', gotoYM);
  selMonth.addEventListener('change', gotoYM);

  // Insertar en el centro del toolbar
  // (primero año, luego mes, podés invertir si querés)
  centerChunk.appendChild(selYear);
  centerChunk.appendChild(selMonth);
}

// === mantener sincronizados los selects cuando navegas con flechas/hoy ===
function syncYearMonthPickers(calendar) {
  const selYear  = document.getElementById('fc-year-select');
  const selMonth = document.getElementById('fc-month-select');
  if (!selYear || !selMonth) return;

  const d = calendar.getDate();
  if (selYear.value !== String(d.getFullYear())) selYear.value = String(d.getFullYear());
  if (selMonth.value !== String(d.getMonth()))   selMonth.value = String(d.getMonth());
}
