/**
 * ============================================================================
 *  counters.js
 * ----------------------------------------------------------------------------
 *  Contador y listado de "Ensayos" por año:
 *   - updateEnsayoCounter(): actualiza el badge flotante
 *   - openEnsayoList(year): abre una tabla con filtros (EJECUTADO/PROGRAMADO/TODOS)
 *   - copyEnsayoTable(): copia al portapapeles (tabulado)
 * ============================================================================
 */

import { calendar, lastRawEvents } from './state.js';
import { esc, formatDateISO, normalize } from './utils.js';
import { showDetailsModal } from './modals.js';

let ensayoListFilter = 'EJECUTADO'; // 'EJECUTADO' | 'PROGRAMADO' | 'TODOS'

export function updateEnsayoCounter() {
  const badge = document.getElementById('ensayo-counter');
  if (!badge || !calendar) return;

  const visibleYear = calendar.getDate().getFullYear();
  const total = (lastRawEvents || []).reduce((acc, ev) => {
    const y = parseInt((ev.start || '').slice(0, 4), 10);
    const titleN = normalize(ev.title || '');
    const estadoN = normalize(ev.extendedProps?.estado || '');
    return acc + (y === visibleYear && titleN.includes('ENSAYO') && estadoN === 'EJECUTADO' ? 1 : 0);
  }, 0);

  badge.textContent = `📊 Interruptores en ${visibleYear}: ${total}`;
}

export function setEnsayoFilter(newFilter, year) {
  ensayoListFilter = newFilter;
  openEnsayoList(year);
}

export function openEnsayoList(year) {
  const F = ensayoListFilter.toUpperCase();

  const rows = (lastRawEvents || [])
    .filter(ev => {
      const y  = parseInt((ev.start || '').slice(0, 4), 10);
      const t  = (ev.title || '').toUpperCase();
      const st = (ev.extendedProps?.estado || '').toUpperCase();
      if (y !== year || !t.includes('ENSAYO')) return false;
      if (F === 'TODOS') return true;
      return st === F;
    })
    .map(ev => ({
      id:     ev.id, 
      iso:    (ev.start || '').slice(0, 10),
      ut:     ev.extendedProps?.ut || '',
      lado:   ev.extendedProps?.lado || '',
      cuenta: ev.extendedProps?.cuenta || '',
      ajuste: ev.extendedProps?.ajuste || '',
      marca:  ev.extendedProps?.marca || '',
      modelo: ev.extendedProps?.modelo || ''
    }))
    .sort((a, b) => a.iso.localeCompare(b.iso));

  const btn = (label, val) => `
    <button
      onclick="setEnsayoFilter('${val}', ${year})"
      style="
        padding:6px 10px;border:1px solid #d1d5db;cursor:pointer;
        background:${ensayoListFilter===val ? '#e5f3ff' : 'white'};
        color:${ensayoListFilter===val ? '#1f6feb' : '#111'};
        font-weight:${ensayoListFilter===val ? '700' : '600'};
        border-radius:6px;
      ">
      ${label}
    </button>
  `;

  const header = `
    <div class="modal-header">
      <div class="modal-title">Interruptores ensayados en ${year} Total: ${rows.length}</div>
      <div style="display:flex; gap:8px; align-items:center;">
        ${btn('Ejecutados', 'EJECUTADO')}
        ${btn('Programados', 'PROGRAMADO')}
        ${btn('Suspendidos', 'SUSPENDIDO')}
        ${btn('Todos', 'TODOS')}
        <button onclick="copyEnsayoTable()" style="background:#4CAF50;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">📋 Copiar</button>
        <button class="edit-btn" title="Cerrar" onclick="hideDetailsModal()">❌</button>
      </div>
    </div>
    <hr class="modal__divider" />
  `;

  const table = rows.length
    ? `
      <div style="max-height:55vh; overflow:auto;">
        <table id="ensayo-table" style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr>
              <th style="padding:6px; border-bottom:1px solid #e5e7eb;">Fecha</th>
              <th style="padding:6px; border-bottom:1px solid #e5e7eb;">UT</th>
              <th style="padding:6px; border-bottom:1px solid #e5e7eb;">Lado</th>
              <th style="padding:6px; border-bottom:1px solid #e5e7eb;">Cuenta</th>
              <th style="padding:6px; border-bottom:1px solid #e5e7eb;">Marca</th>
              <th style="padding:6px; border-bottom:1px solid #e5e7eb;">Modelo</th>
              <th style="padding:6px; border-bottom:1px solid #e5e7eb;">Ajuste</th>
              <th style="padding:6px; border-bottom:1px solid #e5e7eb;">Detalle</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td style="padding:6px; border-bottom:1px solid #f1f5f9;">${esc(formatDateISO(r.iso))}</td>
                <td style="padding:6px; border-bottom:1px solid #f1f5f9;">${esc(r.ut)}</td>
                <td style="padding:6px; border-bottom:1px solid #f1f5f9;">${esc(r.lado)}</td>
                <td style="padding:6px; border-bottom:1px solid #f1f5f9;">${esc(r.cuenta)}</td>
                <td style="padding:6px; border-bottom:1px solid #f1f5f9;">${esc(r.marca)}</td>
                <td style="padding:6px; border-bottom:1px solid #f1f5f9;">${esc(r.modelo)}</td>
                <td style="padding:6px; border-bottom:1px solid #f1f5f9;">${esc(r.ajuste)}</td>
                <td style="padding:6px; border-bottom:1px solid #f1f5f9; text-align:center;">
                  <button onclick="openEnsayoDetail('${r.id}')"
                    style="padding:3px 6px; border:1px solid #ccc; border-radius:4px; cursor:pointer;">
                    🔍
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
    : `<div style="padding:6px 2px;">No hay ENSAYOS ${F==='TODOS'?'':'con estado '+F} en ${year}.</div>`;

  showDetailsModal(header + table);
  document.getElementById('details-modal')?.classList.add('modal--wide');
}

export function copyEnsayoTable() {
  const table = document.querySelector('#ensayo-table');
  if (!table) return;

  const headers = Array.from(table.querySelectorAll('thead th'))
    .map(th => th.innerText.trim()).join('\t');

  const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
    Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim()).join('\t')
  );

  const text = `${headers}\n${rows.join('\n')}`;
  navigator.clipboard.writeText(text)
    .then(() => alert('📋 Tabla copiada al portapapeles'))
    .catch(err => console.error('Error al copiar:', err));
}

// Exponer para handlers inline que inyecta la tabla
window.openEnsayoList = openEnsayoList;
window.setEnsayoFilter = setEnsayoFilter;
window.copyEnsayoTable = copyEnsayoTable;

// Usa el mismo modal de lectura que el calendario
window.openEnsayoDetail = function (evId) {
  const ev = (lastRawEvents || []).find(e => String(e.id) === String(evId));
  if (!ev) return alert('No se encontró el evento.');

  // Arma el objeto en el formato que espera showEditableModal
  const data = {
    id: ev.id,
    start: ev.start,
    title: ev.title,
    extendedProps: ev.extendedProps || {}
  };

  // Dejo currentEventRef por compatibilidad con botones ✏️/📄 en el header
  if (window.currentEventRef && 'value' in window.currentEventRef) {
    window.currentEventRef.value = data;
  }

  // Abre en modo SOLO LECTURA (igual que al hacer click en un evento)
  if (typeof window.showEditableModal === 'function') {
    window.showEditableModal(data, false);
  } else {
    alert('No se pudo abrir el modal de detalles (showEditableModal no está disponible).');
  }
};
