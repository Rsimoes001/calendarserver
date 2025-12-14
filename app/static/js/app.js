/**
 * ============================================================================
 *  app.js  (ENTRY POINT)
 * ----------------------------------------------------------------------------
 *  Inicializa:
 *   - Modal de contraseña (wiring de botones)
 *   - Calendario (FullCalendar)
 *   - Badge de ensayos (click → listado)
 * ============================================================================
 */

import { initCalendar } from './calendar.js';
import { wirePasswordButtons } from './password.js';
import { updateEnsayoCounter, openEnsayoList } from './counters.js';
import { hideDetailsModal } from './modals.js'; 
import './duplicate.js';
import './cromo.js';

document.addEventListener('DOMContentLoaded', () => {
  wirePasswordButtons();
  initCalendar();

  // ← NUEVO: close del botón rojo inferior
  document.getElementById('details-modal-close')
    ?.addEventListener('click', hideDetailsModal);

  const badge = document.getElementById('ensayo-counter');
  if (badge) {
    badge.style.cursor = 'pointer';
    badge.title = 'Ver listado';
    badge.addEventListener('click', () => {
      const year = (window.calendar?.getDate?.().getFullYear?.()) || new Date().getFullYear();
      openEnsayoList(year);
    });
  }

  updateEnsayoCounter();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideDetailsModal();
});

// ========== User Menu (perfil) ==========
(function(){
  const btn = document.getElementById('user-menu-btn');
  const menu = document.getElementById('user-menu');
  if (!btn || !menu) return;

  const toggle = (open) => {
    const isOpen = open ?? (menu.getAttribute('aria-hidden') === 'true');
    menu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) {
      menu.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      menu.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });

  // ——— Avatar con iniciales (si falla la imagen) ———
  function setInitials(el, name){
    if (!el) return;
    const initials = (name || '')
      .split(/\s+/).filter(Boolean).slice(0,2)
      .map(s => s[0]?.toUpperCase() || '').join('') || 'U';
    el.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#0d6efd"/>
            <stop offset="1" stop-color="#6610f2"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="50" fill="url(#g)"/>
        <text x="50" y="58" font-family="Segoe UI, Arial" font-size="40"
              text-anchor="middle" fill="#fff" font-weight="700">${initials}</text>
      </svg>
    `);
  }
  // si no tenés imagen real, podés forzar iniciales así:
  // setInitials(btn.querySelector('.avatar'), document.body.dataset.username);
  // setInitials(menu.querySelector('.avatar--lg'), document.body.dataset.username);
})();


// === Cambiar contraseña ===
const openChange = document.getElementById('open-change-pass');
const modalChange = document.getElementById('change-pass-modal');
const formChange  = document.getElementById('change-pass-form');
const msgChange   = document.getElementById('change-pass-msg');
const btnCancel   = document.getElementById('change-pass-cancel');

function showChangeModal() {
  msgChange.style.display = 'none';
  msgChange.textContent = '';
  formChange.reset();
  modalChange.style.display = 'block';
  modalChange.setAttribute('aria-hidden', 'false');
}
function hideChangeModal() {
  modalChange.style.display = 'none';
  modalChange.setAttribute('aria-hidden', 'true');
}

openChange?.addEventListener('click', (e) => {
  e.preventDefault();
  showChangeModal();
});
btnCancel?.addEventListener('click', hideChangeModal);

// Enviar
formChange?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(formChange).entries());

  msgChange.classList.remove('ok');
  msgChange.style.display = 'none';

  try {
    const res = await fetch('/api/cambiar_clave', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });
    const out = await res.json();

    msgChange.style.display = 'block';
    msgChange.textContent = out.message || (out.success ? 'Listo' : 'Error');

    if (out.success) {
      // opcional: clase verde si tenés estilos
      msgChange.classList.add('ok');
      setTimeout(() => {
        hideChangeModal();
      }, 1200);
    }
  } catch (err) {
    msgChange.style.display = 'block';
    msgChange.textContent = 'Error de red.';
  }
});

// Detectar tema guardado en localStorage
const root = document.documentElement;
const savedTheme = localStorage.getItem("theme");
if (savedTheme) {
  root.setAttribute("data-theme", savedTheme);
}

// Listener del toggle
document.addEventListener("DOMContentLoaded", () => {
  const themeToggle = document.querySelector("#theme-toggle");

  if (themeToggle) {
    // Estado inicial del switch
    themeToggle.checked = root.getAttribute("data-theme") === "dark";

    themeToggle.addEventListener("change", () => {
      if (themeToggle.checked) {
        root.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
      } else {
        root.setAttribute("data-theme", "light");
        localStorage.setItem("theme", "light");
      }
    });
  }
});


