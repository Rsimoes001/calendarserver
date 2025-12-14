/**
 * ============================================================================
 *  password.js
 * ----------------------------------------------------------------------------
 *  Modal de contraseña reutilizado por:
 *   - mover eventos (eventDrop)
 *   - crear/editar/duplicar tareas
 *  API:
 *    askPassword(message): Promise<string|null>
 *    confirmPasswordModal(confirm: boolean): void
 *    wirePasswordButtons(): instala listeners en botones del modal
 * ============================================================================
 */

import { passwordResolver, setPasswordResolver } from './state.js';

/**
 * Abre el diálogo y resuelve con:
 *  - string (contraseña)
 *  - null si canceló
 */
export const askPassword = (message) => new Promise((resolve) => {
  setPasswordResolver(resolve);

  const input = document.getElementById('password-input');
  const msg   = document.getElementById('password-message');
  const modal = document.getElementById('password-modal');

  if (msg)   msg.textContent = message || 'Ingrese la contraseña:';

  // Mostrar como overlay centrado
  if (modal) {
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  // Limpiar y enfocar
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 10);
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmPasswordModal(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        confirmPasswordModal(false);
      }
    };
  }
});

/** Cierra el modal y resuelve la promesa */
export function confirmPasswordModal(confirm) {
  const modal = document.getElementById('password-modal');
  const input = document.getElementById('password-input');

  const pass = confirm ? (input?.value || '') : null;

  if (input) input.value = '';
  if (modal) {
    modal.setAttribute('hidden', '');
    modal.setAttribute('aria-hidden', 'true');
  }

  (passwordResolver || (()=>{}))(pass);
  setPasswordResolver(null);
}

/** Enlaza botones del modal (llamar una vez en app.js) */
export function wirePasswordButtons() {
  document.getElementById('password-accept')
    ?.addEventListener('click', () => confirmPasswordModal(true));
  document.getElementById('password-cancel')
    ?.addEventListener('click', () => confirmPasswordModal(false));
}
