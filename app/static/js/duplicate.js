/**
 * ============================================================================
 *  duplicate.js
 * ----------------------------------------------------------------------------
 *  Diálogo de "Duplicar" y creación de copia usando /api/crear_tarea.
 *  Solo cambia fecha (y opcionalmente estado). Copia el resto de campos tal cual.
 * ============================================================================
 */

import { calendar, currentEvent } from './state.js';
import { askPassword } from './password.js';
import { postCrearTarea } from './api.js';
import { showDetailsModal, hideDetailsModal } from './modals.js';

export function openDuplicateDialog(evData) {
  const ev = evData || currentEvent;
  if (!ev) { alert('⚠️ No hay evento para duplicar.'); return; }

  const todayISO = (ev.start || '').slice(0, 10) || new Date().toISOString().slice(0, 10);

  const html = `
    <div class="modal-header">
      <div class="modal-title">📄 Duplicar tarea</div>
      <button class="edit-btn" title="Cerrar" onclick="hideDetailsModal()">❌</button>
    </div>
    <hr class="modal__divider" />
    <form class="form-grid form-edit" onsubmit="return false;">
      <label for="dup-fecha">Nueva fecha</label>
      <input id="dup-fecha" type="date" value="${todayISO}" required>

      <label for="dup-estado">Estado</label>
      <select id="dup-estado">
        <option>PROGRAMADO</option>
        <option>EJECUTADO</option>
        <option>REPROGRAMADO</option>
        <option>SUSPENDIDO</option>
      </select>

      <div class="span-2" style="margin-top:8px; font-size:12px; opacity:.8;">
        Se copiarán todos los demás campos desde la tarea original (UT, tipo, marca, modelo, lugar, ajustes, horario, comentario y flags).
      </div>
    </form>

    <div class="modal__actions">
      <button class="btn btn--success" type="button" onclick="duplicateTask('${ev.id}')">💾 Crear copia</button>
    </div>
  `;
  showDetailsModal(html);
}

export async function duplicateTask(taskId) {
  const ev = currentEvent;
  if (!ev || String(ev.id) !== String(taskId)) { alert('No se pudo identificar la tarea.'); return; }

  const props = ev.extendedProps || {};
  const fechaNueva  = (document.getElementById('dup-fecha')?.value || '').trim();
  const estadoNuevo = (document.getElementById('dup-estado')?.value || 'PROGRAMADO').trim();
  if (!fechaNueva) { alert('Elegí la nueva fecha.'); return; }

  const payload = {
    fecha: fechaNueva,
    ut: props.ut || '',
    tarea: ev.title || '',
    tipo: props.tipo || '',
    ajuste: props.ajuste || '',
    lugar: props.lugar || '',
    marca: props.marca || '',
    modelo: props.modelo || '',
    pedido: props.pedido || '',
    responsable: props.responsable || '',
    lado: props.lado || '',
    cuenta: props.cuenta || '',
    tx_zona: !!props.tx_zona,
    rx_zona: !!props.rx_zona,
    tx_protection: !!props.tx_protection,
    rx_protection: !!props.rx_protection,
    horario: (props.horario || 'SIN HORARIO'),
    comentario: props.comentario || '',
    estado: estadoNuevo,
    zona: props.zona || '',
    partido: props.partido || ''
  };

  const pass = await askPassword('Ingrese la contraseña para crear la copia:');
  if (!pass) return;
  payload.clave = pass;

  try {
    const res = await postCrearTarea(payload);
    if (res.success) {
      hideDetailsModal();
      calendar?.refetchEvents();
    } else {
      alert(`❌ ${res.message || 'No se pudo crear la copia.'}`);
    }
  } catch {
    alert('❌ Error de red al duplicar.');
  }
}

// Exponer para handlers inline generados en el header de modals.js
window.openDuplicateDialog = openDuplicateDialog;
window.duplicateTask       = duplicateTask;
