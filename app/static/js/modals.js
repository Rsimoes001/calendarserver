/**
 * ============================================================================
 *  modals.js
 * ----------------------------------------------------------------------------
 *  Render y lógica de:
 *   - Modal Detalles (lectura/edición)
 *   - Overlay CROMO
 *  Mantiene el botón ✏️ (Editar) EXACTO como lo tenías; agrega:
 *   - 📄 Duplicar (solo en lectura)
 *   - ❌ Cerrar (solo en lectura) / ❌ Cancelar (en edición)
 *  Visuales: header con badges, grilla uniforme, copy en UT/Ajuste,
 *  sticky header, y acciones claras.
 * ============================================================================
 */

import { calendar, currentEvent, setCurrentEvent } from './state.js';
import {
  TYPE_OPTIONS, OBRADOR_OPTIONS, ESTADO_OPTIONS,
  fillSelect, getBrands, getModels,
  parseHorario, formatHorario, esc
} from './utils.js';
import { ubicacionLookup, postCrearTarea, postEditarTarea } from './api.js';
import { askPassword } from './password.js';

/* =======================
 * Utils de UI / formato
 * ======================= */
const fmt = {
  v(x) { return (x ?? '').toString().trim(); },
  dash(x) { const t = this.v(x); return t ? t : '—'; },
  yesno(x) { return x ? 'Sí' : 'No'; },
  upper(x) { return this.v(x).toUpperCase(); },
};

function badge(text, kind = 'neutral') {
  const t = fmt.v(text);
  if (!t) return '';
  const cls = `badge badge--${kind}`;
  return `<span class="${cls}" title="${esc(t)}">${esc(t)}</span>`;
}

function copyBtn(title, value) {
  const v = fmt.v(value);
  if (!v) return '';
  const id = 'cp_' + Math.random().toString(36).slice(2, 9);
  return `
    <button type="button" class="btn btn--icon" title="${esc(`Copiar ${title}`)}"
            aria-label="${esc(`Copiar ${title}`)}" data-copy="${esc(v)}" id="${id}">
      📋
    </button>`;
}

function wireCopyButtons(scope = document) {
  const fallbackCopy = (text) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
  };

  scope.querySelectorAll('button[data-copy]')?.forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy || '';
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          fallbackCopy(text);
        }
        btn.classList.add('is-copied');
        btn.title = '¡Copiado!';
        setTimeout(() => { btn.classList.remove('is-copied'); btn.title = 'Copiar'; }, 1200);
      } catch {
        // Último recurso
        fallbackCopy(text);
        btn.classList.add('is-copied');
        setTimeout(() => btn.classList.remove('is-copied'), 1200);
      }
    });
  });
}


/* =======================
 * Modal base (DOM)
 * ======================= */

function unhide(el) {
  if (!el) return;
  el.removeAttribute('hidden');
  el.setAttribute('aria-hidden', 'false');
  el.style.display = 'block';
}

function hide(el) {
  if (!el) return;
  el.setAttribute('hidden', '');
  el.setAttribute('aria-hidden', 'true');
  el.style.display = 'none';
}

function wireBasicModalUX(modalEl, closeFn) {
  const onKey = (e) => { if (e.key === 'Escape') closeFn(); };
  const onClick = (e) => {
    const content = modalEl.querySelector('.modal__content') || modalEl.firstElementChild;
    if (content && !content.contains(e.target)) closeFn();
  };
  modalEl.addEventListener('keydown', onKey, { once: false });
  modalEl.addEventListener('click', onClick);
  modalEl.querySelector('#details-modal-close')?.addEventListener('click', closeFn, { once: false });

  return () => {
    modalEl.removeEventListener('keydown', onKey);
    modalEl.removeEventListener('click', onClick);
  };
}

let cleanupDetailsUX = null;
let cleanupCromoUX = null;

export const showDetailsModal = (html) => {
  const modal = document.getElementById('details-modal');
  const box   = document.getElementById('details-modal-content');
  if (!modal || !box) return;

  box.innerHTML = html;
  unhide(modal);
  modal.tabIndex = -1; modal.focus();

  cleanupDetailsUX?.();
  cleanupDetailsUX = wireBasicModalUX(modal, hideDetailsModal);
};

export const hideDetailsModal = () => {
  const modal = document.getElementById('details-modal');
  if (!modal) return;
  hide(modal);
  const dm = document.getElementById('details-modal');
  dm?.classList.remove('modal--wide', 'modal__header--sticky');
  cleanupDetailsUX?.(); cleanupDetailsUX = null;
};

// CROMO overlay
export const showCromoOverlay = (html) => {
  const modal = document.getElementById('cromo-modal');
  const box   = document.getElementById('cromo-modal-content');
  if (!modal || !box) return;

  box.innerHTML = html;
  unhide(modal);
  modal.tabIndex = -1; modal.focus();

  cleanupCromoUX?.();
  cleanupCromoUX = wireBasicModalUX(modal, hideCromoOverlay);
};

export const hideCromoOverlay = () => {
  const modal = document.getElementById('cromo-modal');
  hide(modal);
  cleanupCromoUX?.(); cleanupCromoUX = null;
};

/* =======================
 * Componentes de render
 * ======================= */

function renderKV(label, value, opts = {}) {
  const { span2 = false, mono = false, raw = false } = opts;
  const v = raw ? (value ?? '') : esc(fmt.dash(value));
  return `
    <div class="kv${span2 ? ' kv--span2' : ''}">
      <div class="kv__k">${esc(label)}</div>
      <div class="kv__v${mono ? ' kv__v--mono' : ''}">${v}</div>
    </div>`;
}

function renderField(label, key, value, isEdit, opts = {}) {
  const id = `edit-${key}`;
  const { type='text', multiline=false, boolean=false, span2=false, options=null, mono=false } = opts;

  if (isEdit) {
    if (options && Array.isArray(options)) {
      const cur = String(value ?? '').toUpperCase();
      const optsHtml = options.map(o => {
        const v = String(o);
        const sel = cur === v.toUpperCase() ? 'selected' : '';
        return `<option value="${esc(v)}" ${sel}>${esc(v)}</option>`;
      }).join('');
      return `
        <div class="kv${span2 ? ' kv--span2' : ''}">
          <label class="kv__k" for="${id}">${esc(label)}</label>
          <div class="kv__v">
            <select id="${id}" class="input">${optsHtml}</select>
          </div>
        </div>`;
    }
    if (boolean) {
      const val = String(value ?? '').toLowerCase();
      const yes = ['si', 'sí', 'true', '1', 'x'].includes(val);
      return `
        <div class="kv${span2 ? ' kv--span2' : ''}">
          <label class="kv__k" for="${id}">${esc(label)}</label>
          <div class="kv__v">
            <select id="${id}" class="input">
              <option value="true" ${yes ? 'selected' : ''}>Sí</option>
              <option value="false" ${!yes ? 'selected' : ''}>No</option>
            </select>
          </div>
        </div>`;
    }
    if (multiline) {
      return `
        <div class="kv kv--span2">
          <label class="kv__k" for="${id}">${esc(label)}</label>
          <div class="kv__v">
            <textarea id="${id}" class="input input--area">${esc(value ?? '')}</textarea>
          </div>
        </div>`;
    }
    return `
      <div class="kv${span2 ? ' kv--span2' : ''}">
        <label class="kv__k" for="${id}">${esc(label)}</label>
        <div class="kv__v">
          <input id="${id}" class="input${mono ? ' input--mono' : ''}" type="${type}" value="${esc(value ?? '')}">
        </div>
      </div>`;
  }

  // Solo lectura
  return renderKV(label, value, { span2, mono });
}

/* =======================
 * Modal principal
 * ======================= */
export function showEditableModal(eventData, editable = false) {
  const dm = document.getElementById('details-modal');
  dm?.classList.add('modal--wide', 'modal__header--sticky');

  if (eventData) setCurrentEvent(eventData);
  const ev = currentEvent;
  if (!ev) { alert('⚠️ No hay evento seleccionado.'); return; }

  const props = ev.extendedProps || {};
  const isEdit = !!editable;
  const horarioParsed = parseHorario(props.horario || '');
  const tarea   = fmt.upper(ev.title || 'TAREA');
  const estado  = fmt.upper(props.estado || '');
  const tipo    = fmt.upper(props.tipo || '');
  const ut      = fmt.v(props.ut);
  const ajuste  = fmt.v(props.ajuste);

  // Badges de cabecera
  const tareaKind = tarea.includes('ENSAYO') ? 'success'
                   : tarea.includes('AJUSTE') ? 'info'
                   : tarea.includes('EVENT') ? 'warn'
                   : 'neutral';
  const estadoKind = estado === 'EJECUTADO' ? 'success'
                    : estado === 'SUSPENDIDO' ? 'danger'
                    : 'neutral';

  // Header del modal
  const header = `
    <div class="modal-header">
      <div class="modal-title">
        <span>Detalles</span>
        ${tipo ? badge(tipo, 'outline') : ''}
        ${badge(tarea, tareaKind)}
        ${estado ? badge(estado, estadoKind) : ''}
      </div>
      <div class="modal-actions">
        ${
          !isEdit
            ? `
              <button type="button" class="btn btn--icon" title="Editar"
                      onclick="event.stopPropagation(); showEditableModal(null, true)">✏️</button>
              ${ (typeof window.openDuplicateDialog === 'function')
                  ? `<button type="button" class="btn btn--icon" title="Duplicar"
                            onclick="event.stopPropagation(); openDuplicateDialog(window.currentEventRef.value)">📄</button>`
                  : '' }
              <button type="button" class="btn btn--icon" title="Cerrar"
                      onclick="event.stopPropagation(); hideDetailsModal()">❌</button>
            `
            : `
              <button type="button" class="btn btn--icon" title="Cancelar"
                      onclick="event.stopPropagation(); showEditableModal(null, false)">❌</button>
            `
        }
      </div>
    </div>`;


  // Inicio del formulario (o vista)
  let html = `${header}
    <hr class="modal__divider" />
    <form class="form-grid ${isEdit ? '' : 'form-readonly'}" onsubmit="return false;">`;

  // Fila 1: Fecha + UT (lectura con copy / edición como input)
  html += renderField('Fecha', 'fecha', ev.start?.slice(0, 10), isEdit, { type: 'date' });
  if (isEdit) {
    html += renderField('UT', 'ut', ut, true, { mono: true });
  } else {
    html += renderKV('UT', `
      <div class="kv__inline">
        <span>${esc(fmt.dash(ut))}</span>
        ${copyBtn('UT', ut)}
      </div>
    `, { raw: true });
  }

  // Fila 2: Tarea + tipo/marca/modelo
  html += renderField('Tarea', 'tarea', ev.title, isEdit, {
    options: ['ENSAYO', 'AJUSTE', 'FUNCIÓN', 'EVENTOS', 'ACTUALIZAR']
  });

  if (isEdit) {
    html += `
      <div class="kv">
        <label class="kv__k" for="edit-tipo">Tipo</label>
        <div class="kv__v"><select id="edit-tipo" class="input"></select></div>
      </div>
      <div class="kv">
        <label class="kv__k" for="edit-marca">Marca</label>
        <div class="kv__v"><select id="edit-marca" class="input"></select></div>
      </div>
      <div class="kv">
        <label class="kv__k" for="edit-modelo">Modelo</label>
        <div class="kv__v"><select id="edit-modelo" class="input"></select></div>
      </div>`;
  } else {
    html += renderKV('Tipo', tipo);
    html += renderKV('Marca', props.marca);
    html += renderKV('Modelo', props.modelo);
  }

  // Horario
  if (isEdit) {
    html += `
      <div class="kv kv--span2">
        <div class="kv__k">Horario</div>
        <div class="kv__v">
          <div class="time-range">
            <label class="tr__none">
              <input type="checkbox" id="edit-horario-none" ${horarioParsed.none ? 'checked' : ''}>
              Sin horario
            </label>
            <input type="time" id="edit-horario-start" class="input input--time"
                   value="${horarioParsed.start}" ${horarioParsed.none ? 'disabled' : ''}>
            <span class="tr__sep">–</span>
            <input type="time" id="edit-horario-end" class="input input--time"
                   value="${horarioParsed.end}" ${horarioParsed.none ? 'disabled' : ''}>
          </div>
        </div>
      </div>`;
  } else {
    html += renderKV('Horario', formatHorario(horarioParsed) || 'SIN HORARIO');
  }

  // Lugar (Obrador o libre)
  if (isEdit) {
    html += `
      <div class="kv kv--span2">
        <label class="kv__k" for="edit-lugar">Lugar</label>
        <div class="kv__v">
          <label class="inline" style="margin-right:10px;">
            <input type="checkbox" id="edit-lugar-obrador"> Obrador
          </label>
          <select id="edit-lugar-select" class="input hidden" style="margin-right:10px;">
            ${OBRADOR_OPTIONS.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
          </select>
          <input id="edit-lugar" class="input" type="text" value="${(props.lugar ?? '').replace(/"/g, '&quot;')}">
        </div>
      </div>`;
  } else {
    html += renderKV('Lugar', props.lugar);
  }

  // Zona / Localidad (lookup en lectura)
  if (!isEdit) {
    html += renderKV('Zona', `<span id="view-zona">${esc(props.zona || '-')}</span>`, { raw: true });
    html += renderKV('Localidad', `<span id="view-localidad">${esc(props.partido || '-')}</span>`, { raw: true });
  }

  // Pedido / Ajuste (Ajuste con copy en lectura)
  html += renderField('Pedido', 'pedido', props.pedido, isEdit);
  if (isEdit) {
    html += renderField('Ajuste', 'ajuste', props.ajuste, true, { mono: true });
  } else {
    html += renderKV('Ajuste', `
      <div class="kv__inline">
        <span>${esc(fmt.dash(ajuste))}</span>
        ${copyBtn('Ajuste', ajuste)}
      </div>`, { raw: true, mono: true });
  }

  // Lado (con botón CROMO solo en lectura)
  if (isEdit) {
    html += renderField('Lado', 'lado', props.lado, true);
  } else {
    const ladoVal = fmt.dash(props.lado);
    const cromoBtn = (props.lado && props.lado !== '-') ? `
      <button type="button"
              data-lado="${esc(props.lado || '')}"
              onclick="window.showCromoModal(this.dataset.lado)"
              class="btn btn--soft btn--xs" style="margin-left:8px;">
        📄 CROMO
      </button>` : '';
    html += renderKV('Lado', `<span>${esc(ladoVal)}</span>${cromoBtn}`, { raw: true });
  }

  // Cuenta y flags
  html += renderField('Cuenta', 'cuenta', props.cuenta, isEdit);
  html += renderField('TX Zona', 'tx_zona', props.tx_zona ? 'Sí' : 'No', isEdit, { boolean: true });
  html += renderField('RX Zona', 'rx_zona', props.rx_zona ? 'Sí' : 'No', isEdit, { boolean: true });
  html += renderField('TX Protección', 'tx_protection', props.tx_protection ? 'Sí' : 'No', isEdit, { boolean: true });
  html += renderField('RX Protección', 'rx_protection', props.rx_protection ? 'Sí' : 'No', isEdit, { boolean: true });

  // Responsable + Estado
  html += renderField('Responsable', 'responsable', props.responsable, isEdit);
  if (isEdit) {
    html += `
      <div class="kv">
        <label class="kv__k" for="edit-estado">Estado</label>
        <div class="kv__v">
          <select id="edit-estado" class="input">
            ${ESTADO_OPTIONS.map(opt => `
              <option value="${esc(opt)}" ${props.estado === opt ? 'selected' : ''}>${esc(opt)}</option>
            `).join('')}
          </select>
        </div>
      </div>`;
  } else {
    html += renderKV('Estado', props.estado);
  }

  // Comentarios
  html += renderField('Comentarios', 'comentario', props.comentario, isEdit, { multiline: true, span2: true });

  html += `</form>`;

  // Acciones (guardar)
  if (isEdit) {
    html += `
      <div class="modal__actions">
        <button id="save-btn" class="btn btn--success" type="button">💾 Guardar</button>
      </div>`;
  }

  // Pintar modal
  showDetailsModal(html);

  // Wire copy buttons
  wireCopyButtons(document.getElementById('details-modal-content'));

  // ----- lookup de Zona/Partido (solo lectura) -----
  if (!isEdit) {
    const tipoN = (props.tipo || '').toUpperCase();
    const utVal = (props.ut || '').trim();
    if (['RECONECTADOR','SECCIONALIZADOR','SBC','INTERRUPTOR'].includes(tipoN) && utVal) {
      const vz = document.getElementById('view-zona');
      const vp = document.getElementById('view-localidad');
      if (vz) vz.textContent = '...';
      if (vp) vp.textContent = '...';

      ubicacionLookup(utVal, tipoN)
        .then(d => {
          if (d.success && d.item) {
            const zonaCompuesta = [d.item.area_empresa, d.item.poblacion]
              .map(s => (s || '').toString().trim()).filter(Boolean).join(' - ');
            if (vz) vz.textContent = zonaCompuesta || '—';
            if (vp) vp.textContent = (d.item.distrito || '').toString().trim() || '—';
          } else {
            if (vz) vz.textContent = '—';
            if (vp) vp.textContent = '—';
          }
        })
        .catch(() => {
          if (vz) vz.textContent = '—';
          if (vp) vp.textContent = '—';
        });
    }
  }

  // ----- Obrador vs libre (edición) -----
  const chkObr = document.getElementById('edit-lugar-obrador');
  const selObr = document.getElementById('edit-lugar-select');
  const txtLug = document.getElementById('edit-lugar');
  if (chkObr && selObr && txtLug) {
    const actual = fmt.upper(props.lugar || '');
    const isObr  = OBRADOR_OPTIONS.includes(actual);
    if (isObr) selObr.value = actual;

    chkObr.checked = isObr;

    const syncLugarUI = () => {
      if (chkObr.checked) {
        selObr.classList.remove('hidden'); selObr.disabled = false;
        txtLug.classList.add('hidden');    txtLug.disabled = true;
      } else {
        selObr.classList.add('hidden');    selObr.disabled = true;
        txtLug.classList.remove('hidden'); txtLug.disabled = false;
      }
    };
    chkObr.addEventListener('change', syncLugarUI);
    syncLugarUI();
  }

  // ----- Tipo → Marca → Modelo (edición) -----
  if (isEdit) {
    const selTipo   = document.getElementById('edit-tipo');
    const selMarca  = document.getElementById('edit-marca');
    const selModelo = document.getElementById('edit-modelo');

    fillSelect(selTipo, TYPE_OPTIONS, fmt.upper(props.tipo || ''));

    const refreshBrandAndModel = () => {
      const tipoVal = selTipo.value || '';
      fillSelect(selMarca, getBrands(tipoVal), props.marca || '');
      fillSelect(selModelo, getModels(tipoVal, selMarca.value || ''), props.modelo || '');
    };
    const refreshModelOnly = () => {
      fillSelect(selModelo, getModels(selTipo.value || '', selMarca.value || ''), props.modelo || '');
    };

    selTipo?.addEventListener('change', refreshBrandAndModel);
    selMarca?.addEventListener('change', refreshModelOnly);
    refreshBrandAndModel();
  }

  // ----- Horario toggle -----
  const noneChk = document.getElementById('edit-horario-none');
  const hStart  = document.getElementById('edit-horario-start');
  const hEnd    = document.getElementById('edit-horario-end');
  if (noneChk && hStart && hEnd) {
    const syncDisabled = () => { hStart.disabled = hEnd.disabled = noneChk.checked; };
    noneChk.addEventListener('change', syncDisabled);
    syncDisabled();
  }

  // ----- Guardar (crear/editar) -----
  document.getElementById('save-btn')?.addEventListener('click', () => saveEdition(ev.id));
}

/* =======================
 * Persistencia
 * ======================= */
function collectFormData(taskId) {
  const fieldNames = [
    'fecha','ut','tarea','tipo','ajuste','lugar','marca','modelo',
    'pedido','responsable','lado','cuenta',
    'tx_zona','rx_zona','tx_protection','rx_protection',
    'estado','comentario'
  ];

  const data = {};
  for (const name of fieldNames) {
    const el = document.getElementById(`edit-${name}`);
    if (!el) continue;
    let v = (el.value ?? '').trim();
    if (['tx_zona','rx_zona','tx_protection','rx_protection'].includes(name)) {
      const t = v.toLowerCase();
      v = (t === 'sí' || t === 'si' || t === 'true' || t === '1' || t === 'x');
    }
    data[name] = v;
  }

  // Lugar: obrador vs libre
  const chkObr = document.getElementById('edit-lugar-obrador');
  const selObr = document.getElementById('edit-lugar-select');
  const txtLug = document.getElementById('edit-lugar');
  if (chkObr && selObr && txtLug) {
    data.lugar = chkObr.checked ? selObr.value : (txtLug.value || '').trim();
  }

  // Horario
  const noneChk = document.getElementById('edit-horario-none');
  const hStart  = document.getElementById('edit-horario-start');
  const hEnd    = document.getElementById('edit-horario-end');
  if (noneChk && hStart && hEnd) {
    const horario = formatHorario({ start: hStart.value, end: hEnd.value, none: noneChk.checked });
    data.horario = horario || 'SIN HORARIO';
  }

  // Estado
  const selEstado = document.getElementById('edit-estado');
  if (selEstado) data.estado = selEstado.value;

  // id / zona / partido
  const isEdit = !!taskId;
  if (isEdit) {
    data.id_tarea = taskId;
    data.zona = currentEvent?.extendedProps?.zona || '';
    data.partido = currentEvent?.extendedProps?.partido || '';
  } else {
    data.zona = '';
    data.partido = '';
  }

  return { data, isEdit };
}

async function saveEdition(taskId) {
  const { data, isEdit } = collectFormData(taskId);

  const pass = await askPassword(`Ingrese la contraseña para ${isEdit ? 'guardar cambios' : 'crear la tarea'}:`);
  if (!pass) return;
  data.clave = pass;

  const urlCaller = isEdit ? postEditarTarea : postCrearTarea;

  urlCaller(data)
    .then((res) => {
      if (res.success) {
        hideDetailsModal();
        calendar?.refetchEvents();
      } else {
        alert(`❌ ${res.message || 'No se pudo guardar.'}`);
      }
    })
    .catch(() => alert('❌ Error de red al guardar.'));
}

/* =======================
 * Exports globales (para handlers inline ya existentes)
 * ======================= */
window.showEditableModal = showEditableModal;
window.hideDetailsModal  = hideDetailsModal;
window.hideCromoOverlay  = hideCromoOverlay;
