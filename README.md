

# Telecontrol · Calendario de Tareas (estructura)

Esta carpeta contiene una **estructura completa** para tu app Flask + FullCalendar.

## Cómo correr en local (sin Docker)
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scriptsctivate
pip install -r requirements.txt
python app/server.py
# Abrí http://localhost:5000
```

## Cómo correr con Docker
```bash
docker build -t calendar-server .
docker run -p 5000:5000 -e SECRET_KEY="cambia-esta-clave" calendar-server
```

## FullCalendar
En `templates/index.html` se carga FullCalendar por **CDN**:
- CSS: `https://cdn.jsdelivr.net/npm/fullcalendar@6.1.18/main.min.css`
- JS:  `https://cdn.jsdelivr.net/npm/fullcalendar@6.1.18/main.min.js`
- Locales: `https://cdn.jsdelivr.net/npm/fullcalendar@6.1.18/locales-all.min.js`

Si preferís archivos locales, colocá `main.min.css` y `locales-all.min.js` en `app/static/fullcalendar/`
y cambia las etiquetas `<link>`/`<script>` en `index.html`.

## Reemplazar el servidor
`app/server.py` es un **placeholder** mínimo para que la estructura funcione.
Reemplázalo por tu `server.py` completo (con SQLite, autenticación y las APIs reales).

## CI/CD con GitHub Actions
El workflow `./.github/workflows/ci.yml`:
1. Instala dependencias de Python.
2. Ejecuta **Snyk** (debes crear el secreto `SNYK_TOKEN` en GitHub).
3. Construye una imagen Docker y la publica como **artifact** (`calendar-server-image.tar.gz`).

### Crear el secreto SNYK_TOKEN
- GitHub → Settings → Secrets and variables → Actions → **New repository secret**
- Name: `SNYK_TOKEN`
- Value: tu token de Snyk.

## Variables de entorno
- `SECRET_KEY`: clave de sesión Flask.
- `CLAVE_EDICION`: si tu backend requiere clave para editar/crear.

---
> Autor: Área Telecontrol · Uso interno

# calendarserver
calendario

