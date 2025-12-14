/**
 * ============================================================================
 *  cromo.js
 * ----------------------------------------------------------------------------
 *  Modal CROMO (overlay) con información técnica por "Lado".
 *  Reutiliza GET /api/cromo?lado= y dibuja tabla.
 * ============================================================================
 */

import { fetchCromo } from './api.js';
import { esc } from './utils.js';
import { showCromoOverlay } from './modals.js';

export async function showCromoModal(lado) {
  if (!lado || lado.trim() === '-') { alert('No hay lado para buscar.'); return; }
  try {
    const data = await fetchCromo(lado);
    if (!data.success) { alert(data.message || 'Error.'); return; }
    if (!data.items?.length) { alert('No se encontró información de CROMO.'); return; }

    const hasCarpeta = (data.items || []).some(it => String(it.Carpeta ?? '').trim() !== '');

    const rowsHtml = data.items.map(it => {
      const path = String(it.Carpeta ?? '').trim();
      return `
        <tr>
          <td>${esc(it.UT)}</td>
          <td>${esc(it.Cuenta)}</td>
          <td>${esc(it.Lado)}</td>
          <td>${esc(it.Clase)}</td>
          <td>${esc(it.Celda)}</td>
          <td>${esc(it.Conexion)}</td>
          ${hasCarpeta ? `
            <td class="carpeta-cell">
              ${path ? `<button class="icon-btn" type="button" title="Copiar ruta" data-path="${esc(path)}" onclick="copyCarpeta(this)">📂</button>` : ''}
            </td>` : ''}
        </tr>
      `;
    }).join('');

    const html = `
      <div class="modal-header">
        <div class="modal-title">📄 Información CROMO - ${esc(lado)}</div>
        <button class="edit-btn" title="Cerrar" onclick="window.hideCromoOverlay()">❌</button>
      </div>
      <hr class="modal__divider" />
      <div style="max-height:55vh; overflow:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr>
              <th>UT</th><th>Cuenta</th><th>Lado</th><th>Clase</th><th>Celda</th><th>Conexión</th>
              ${hasCarpeta ? '<th>Carpeta</th>' : ''}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div class="modal__actions">
        <button class="btn btn--danger" onclick="window.hideCromoOverlay()">Cerrar</button>
      </div>
    `;
    showCromoOverlay(html);
  } catch (err) {
    console.error(err);
    alert('Error al obtener datos de CROMO.');
  }
}

window.showCromoModal = showCromoModal;
window.copyCarpeta = async function (btn) {
  const path = btn?.dataset?.path || '';
  if (!path) return;
  try {
    await navigator.clipboard.writeText(path);
    alert('📋 Ruta copiada');
  } catch {
    alert('No se pudo copiar la ruta.');
  }
};
