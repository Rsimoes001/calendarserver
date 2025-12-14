"""
===============================================================================
 Calendario de Tareas - Telecontrol MT
 Flask + SQLite + FullCalendar
 - Autenticación con tabla 'usuario' (SQLite)
 - Hash de contraseñas con werkzeug.security (scrypt/pbkdf2)
 - Timestamps en hora local con formato "YYYY-MM-DD HH:MM:SS"
===============================================================================
"""

from flask import (
    Flask, render_template, jsonify, request,
    session, redirect, url_for, abort
)
from waitress import serve
import sqlite3
import os
import logging
from logging.handlers import RotatingFileHandler
from contextlib import closing
from functools import wraps
from datetime import datetime, timedelta
from werkzeug.security import check_password_hash, generate_password_hash

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
app = Flask(__name__)
# Cambia en producción por uno largo/aleatorio
app.config["SECRET_KEY"] = "cambiame-bien-largo-y-aleatorio"
# Duración de sesión cuando marcan “Mantener sesión”
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=8)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'db', 'telecontrol.sqlite')

# Logs
LOG_DIR = os.path.join(BASE_DIR, "logs")
os.makedirs(LOG_DIR, exist_ok=True)
file_handler = RotatingFileHandler(os.path.join(LOG_DIR, "app.log"),
                                   maxBytes=1_000_000, backupCount=5)
fmt = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
file_handler.setFormatter(fmt); file_handler.setLevel(logging.INFO)
console = logging.StreamHandler(); console.setFormatter(fmt); console.setLevel(logging.INFO)
app.logger.setLevel(logging.INFO); app.logger.addHandler(file_handler); app.logger.addHandler(console)

# -----------------------------------------------------------------------------
# DB
# -----------------------------------------------------------------------------
def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

# -----------------------------------------------------------------------------
# AUTH (tabla: usuario)  — Fechas en LOCAL TIME con formato SQLite
# -----------------------------------------------------------------------------
def _now_local_str() -> str:
    """Devuelve 'YYYY-MM-DD HH:MM:SS' en hora local (como SQLite localtime)."""
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')

def _plus_local_minutes_str(minutes: int) -> str:
    return (datetime.now() + timedelta(minutes=minutes)).strftime('%Y-%m-%d %H:%M:%S')

def _norm_user(u: str) -> str:
    # Si querés login case-insensitive
    return (u or "").strip().upper()

def get_usuario_por_nombre(conn, username: str):
    cur = conn.cursor()
    cur.execute("""
        SELECT *
          FROM usuario
         WHERE UPPER(nombre_usuario) = ?
         LIMIT 1
    """, (_norm_user(username),))
    return cur.fetchone()

def is_locked(row) -> bool:
    lu = row["bloqueado_hasta"]
    if not lu:
        return False
    try:
        # 'bloqueado_hasta' está en hora local; comparamos contra hora local
        return datetime.strptime(lu, '%Y-%m-%d %H:%M:%S') > datetime.now()
    except Exception:
        return False

def record_login_success(conn, id_usuario: int):
    cur = conn.cursor()
    cur.execute("""
        UPDATE usuario
           SET ultimo_login = ?,
               intentos_fallidos = 0,
               bloqueado_hasta = NULL,
               fecha_actualizacion = ?
         WHERE id_usuario = ?
    """, (_now_local_str(), _now_local_str(), id_usuario))
    conn.commit()

def record_login_failure(conn, id_usuario: int, max_intentos: int = 5, lock_min: int = 10):
    cur = conn.cursor()
    cur.execute("SELECT intentos_fallidos FROM usuario WHERE id_usuario = ?", (id_usuario,))
    row = cur.fetchone()
    intentos = (row["intentos_fallidos"] if row else 0) + 1
    bloqueado_hasta = None
    if intentos >= max_intentos:
        bloqueado_hasta = _plus_local_minutes_str(lock_min)
        intentos = 0
    cur.execute("""
        UPDATE usuario
           SET intentos_fallidos = ?,
               bloqueado_hasta = ?,
               fecha_actualizacion = ?
         WHERE id_usuario = ?
    """, (intentos, bloqueado_hasta, _now_local_str(), id_usuario))
    conn.commit()

def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("login", next=request.path))
        return f(*args, **kwargs)
    return wrapper

def role_required(*roles):
    def deco(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            u = session.get("user")
            if not u or u.get("role") not in roles:
                abort(403)
            return f(*args, **kwargs)
        return wrapper
    return deco

# -----------------------------------------------------------------------------
# ROUTES: LOGIN / LOGOUT
# -----------------------------------------------------------------------------
@app.get("/login")
def login():
    if "user" in session:
        return redirect(url_for("index"))
    return render_template("login.html")

@app.post("/login")
def login_post():
    username = (request.form.get("username") or "").strip()
    password = request.form.get("password") or ""
    remember = request.form.get("remember") == "1"

    with get_connection() as conn:
        row = get_usuario_por_nombre(conn, username)

    if not row:
        return render_template("login.html", error="Usuario o contraseña inválidos."), 401
    if not row["activo"]:
        return render_template("login.html", error="Cuenta deshabilitada."), 403
    if is_locked(row):
        return render_template("login.html", error="Cuenta bloqueada temporalmente. Intente más tarde."), 423

    # Valida hash generado con scrypt/pbkdf2 por Werkzeug
    if not check_password_hash(row["clave_hash"], password):
        with get_connection() as conn:
            record_login_failure(conn, row["id_usuario"])
        return render_template("login.html", error="Usuario o contraseña inválidos."), 401

    with get_connection() as conn:
        record_login_success(conn, row["id_usuario"])

    session["user"] = {
        "id": row["id_usuario"],
        "username": row["nombre_usuario"],
        "role": row["rol"],
    }
    session.permanent = bool(remember)
    return redirect(request.args.get("next") or url_for("index"))

@app.route("/logout", methods=["GET", "POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))

# -----------------------------------------------------------------------------
# API: CAMBIAR CONTRASEÑA
# -----------------------------------------------------------------------------
@app.post("/api/cambiar_clave")
@login_required
def api_cambiar_clave():
    data = request.get_json() or {}
    actual  = (data.get("actual") or "").strip()
    nueva   = (data.get("nueva") or "").strip()
    repetir = (data.get("repetir") or "").strip()

    # Validaciones básicas
    if not actual or not nueva or not repetir:
        return jsonify({"success": False, "message": "Complete todos los campos."}), 400
    if nueva != repetir:
        return jsonify({"success": False, "message": "La confirmación no coincide."}), 400
    if len(nueva) < 8 or not any(c.isdigit() for c in nueva) or not any(c.isalpha() for c in nueva):
        return jsonify({"success": False, "message": "La nueva contraseña debe tener al menos 8 caracteres, letras y números."}), 400

    uid = session["user"]["id"]

    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT clave_hash FROM usuario WHERE id_usuario = ?", (uid,))
            row = cur.fetchone()
            if not row:
                return jsonify({"success": False, "message": "Usuario no encontrado."}), 404

            if not check_password_hash(row["clave_hash"], actual):
                return jsonify({"success": False, "message": "La contraseña actual no es correcta."}), 400

            # Evitar que sea igual a la anterior
            if check_password_hash(row["clave_hash"], nueva):
                return jsonify({"success": False, "message": "La nueva contraseña no puede ser igual a la actual."}), 400

            nuevo_hash = generate_password_hash(nueva)
            cur.execute("""
                UPDATE usuario
                   SET clave_hash = ?, fecha_actualizacion = ?
                 WHERE id_usuario = ?
            """, (nuevo_hash, _now_local_str(), uid))
            conn.commit()

        app.logger.info(f"Usuario {uid} actualizó su contraseña")
        return jsonify({"success": True, "message": "Contraseña actualizada correctamente."})

    except Exception as e:
        app.logger.exception("Error en /api/cambiar_clave")
        return jsonify({"success": False, "message": "Error interno."}), 500

# -----------------------------------------------------------------------------
# UI
# -----------------------------------------------------------------------------
@app.route('/')
@login_required
def index():
    u = session.get("user", {})
    return render_template('index.html',
                           username=u.get("username", ""),
                           role=u.get("role", ""))

# -----------------------------------------------------------------------------
# API: TAREAS
# -----------------------------------------------------------------------------
@app.route("/api/tareas")
def tareas():
    try:
        with get_connection() as conn:
            with closing(conn.cursor()) as cursor:
                cursor.execute("""
                    SELECT id_tarea, fecha, horario, ut, tarea, tipo, lugar, pedido, marca, modelo,
                           ajuste, responsable, estado, comentario,
                           tx_zona, rx_zona, tx_protection, rx_protection,
                           lado, cuenta, locked_by
                    FROM tarea
                """)
                rows = cursor.fetchall()

        eventos = []
        for row in rows:
            fecha_str = str(row["fecha"]).split(" ")[0] if row["fecha"] else None
            tipo_tarea = (row["tarea"] or "").upper()
            if "ENSAYO" in tipo_tarea:
                clase = "evento-ensayo"
            elif "AJUSTE" in tipo_tarea:
                clase = "evento-ajuste"
            elif "EVENTOS" in tipo_tarea:
                clase = "evento-evento"
            elif "FUNCIÓN" in tipo_tarea or "FUNCION" in tipo_tarea:
                clase = "evento-funcionalidad"
            elif "ACTUALIZAR" in tipo_tarea:
                clase = "evento-actualizar"
            else:
                clase = "evento-default"

            eventos.append({
                "id": row["id_tarea"],
                "title": row["tarea"],
                "start": fecha_str,
                "allDay": True,
                "order": "000",
                "classNames": [clase],
                "extendedProps": dict(row)
            })

        ip = request.headers.get("X-Forwarded-For", request.remote_addr)
        app.logger.info(f"/api/tareas: {len(eventos)} tareas devueltas | IP: {ip}")
        return jsonify(eventos)
    except Exception:
        app.logger.exception("Error en /api/tareas")
        return jsonify([]), 500

# -----------------------------------------------------------------------------
# API: UBICACIÓN LOOKUP
# -----------------------------------------------------------------------------
@app.get("/api/ubicacion_lookup")
def ubicacion_lookup():
    ut = (request.args.get("ut") or "").strip()
    tipo = (request.args.get("tipo") or "").strip().upper()
    if not ut:
        return jsonify({"success": False, "message": "Falta 'ut'"}), 400

    ut_norm = ut.replace(" ", "").replace("-", "").upper()
    ut_with_c = ut_norm if ut_norm.endswith("C") else ut_norm + "C"
    ut_no_c   = ut_norm[:-1] if ut_norm.endswith("C") else ut_norm

    table_map = {
        "INTERRUPTOR": "centro",
        "RECONECTADOR": "seccionador",
        "SECCIONALIZADOR": "seccionador",
        "SBC": "seccionador",
    }
    table = table_map.get(tipo)

    try:
        with get_connection() as conn:
            cur = conn.cursor()

            def sql_for(table_name):
                return f"""
                    SELECT
                      "Ubicac.técnica"  AS ut,
                      "Área de empresa" AS area_empresa,
                      "Población"       AS poblacion,
                      "Distrito"        AS distrito
                    FROM "{table_name}"
                    WHERE UPPER(REPLACE(REPLACE(CAST("Ubicac.técnica" AS TEXT),'-',''),' ','')) IN (?, ?)
                    LIMIT 1
                """

            if table:
                cur.execute(sql_for(table), (ut_no_c, ut_with_c))
                row = cur.fetchone()
            else:
                cur.execute(sql_for("seccionador"), (ut_no_c, ut_with_c))
                row = cur.fetchone()
                if not row:
                    cur.execute(sql_for("centro"), (ut_no_c, ut_with_c))
                    row = cur.fetchone()

        if not row:
            return jsonify({"success": True, "item": None})

        item = {
            "area_empresa": row["area_empresa"] or "",
            "poblacion":    row["poblacion"] or "",
            "distrito":     row["distrito"] or "",
        }
        return jsonify({"success": True, "item": item})
    except Exception as e:
        app.logger.exception("Error en /api/ubicacion_lookup")
        return jsonify({"success": False, "message": "DB error", "detail": str(e)}), 500

# -----------------------------------------------------------------------------
# API: FERIADOS
# -----------------------------------------------------------------------------
@app.route("/api/feriados")
def feriados():
    try:
        with get_connection() as conn:
            with closing(conn.cursor()) as cursor:
                cursor.execute("SELECT fecha, title FROM feriado")
                rows = cursor.fetchall()

        feriados = [{
            "title": row["title"],
            "start": str(row["fecha"]).split(" ")[0] if row["fecha"] else None,
            "display": "background",
            "order": "002",
            "classNames": ["fc-holiday"]
        } for row in rows]

        ip = request.headers.get("X-Forwarded-For", request.remote_addr)
        app.logger.info(f"/api/feriados: {len(feriados)} feriados devueltos | IP: {ip}")
        return jsonify(feriados)
    except Exception:
        app.logger.exception("Error en /api/feriados")
        return jsonify([]), 500

# -----------------------------------------------------------------------------
# API: AUSENCIAS
# -----------------------------------------------------------------------------
@app.route("/api/ausencias")
def ausencias():
    try:
        with get_connection() as conn:
            with closing(conn.cursor()) as cursor:
                cursor.execute("SELECT fecha, usuario FROM ausencia")
                rows = cursor.fetchall()

        eventos = [{
            "title": f"Ausente: {row['usuario']}",
            "start": str(row["fecha"]).split(" ")[0] if row["fecha"] else None,
            "allDay": True,
            "order": "001",
            "classNames": ["evento-ausente"]
        } for row in rows]

        ip = request.headers.get("X-Forwarded-For", request.remote_addr)
        app.logger.info(f"/api/ausencias: {len(eventos)} ausencias devueltas | IP: {ip}")
        return jsonify(eventos)
    except Exception:
        app.logger.exception("Error en /api/ausencias")
        return jsonify([]), 500

# -----------------------------------------------------------------------------
# API: UPDATE FECHA
# -----------------------------------------------------------------------------
@app.route("/api/update_fecha", methods=["POST"])
def update_fecha():
    data = request.get_json()
    id_tarea = data.get("id")
    nueva_fecha = data.get("fecha")
    clave = data.get("clave")

    CLAVE_CORRECTA = "Sanlorenzo"
    if clave != CLAVE_CORRECTA:
        app.logger.warning(f"Clave incorrecta para id_tarea={id_tarea}")
        return jsonify({"success": False, "message": "Contraseña incorrecta."}), 403

    try:
        with get_connection() as conn:
            with closing(conn.cursor()) as cursor:
                cursor.execute("UPDATE tarea SET fecha = ? WHERE id_tarea = ?", (nueva_fecha, id_tarea))
                conn.commit()

        ip = request.headers.get("X-Forwarded-For", request.remote_addr)
        app.logger.info(f"Fecha actualizada para id_tarea={id_tarea} -> {nueva_fecha} | IP: {ip}")
        return jsonify({"success": True})
    except Exception:
        app.logger.exception(f"Error al actualizar fecha para id_tarea={id_tarea}")
        return jsonify({"success": False, "message": "Error interno"}), 500

# -----------------------------------------------------------------------------
# API: EDITAR TAREA
# -----------------------------------------------------------------------------
@app.route("/api/editar_tarea", methods=["POST"])
def editar_tarea():
    data = request.get_json()
    id_tarea = data.get("id_tarea")
    clave = data.get("clave", "").strip()

    if clave != "Sanlorenzo":
        return jsonify({"success": False, "message": "⚠️ Contraseña incorrecta."})

    campos = [
        "fecha", "ut", "tarea", "tipo", "ajuste", "horario", "lugar", "marca", "modelo",
        "pedido", "responsable", "lado", "cuenta",
        "tx_zona", "rx_zona", "tx_protection", "rx_protection",
        "estado", "comentario"
    ]

    try:
        with get_connection() as conn:
            with closing(conn.cursor()) as cursor:
                set_clauses = ", ".join([f"{c} = ?" for c in campos])
                valores = [data.get(c) for c in campos] + [id_tarea]
                cursor.execute(f"UPDATE tarea SET {set_clauses} WHERE id_tarea = ?", valores)
                conn.commit()
        ip = request.headers.get("X-Forwarded-For", request.remote_addr)
        app.logger.info(f"Tarea actualizada (id={id_tarea}) desde {ip}")
        return jsonify({"success": True})
    except Exception as e:
        app.logger.exception(f"Error actualizando tarea (id={id_tarea})")
        return jsonify({"success": False, "message": str(e)}), 500

# -----------------------------------------------------------------------------
# API: CREAR TAREA
# -----------------------------------------------------------------------------
@app.route("/api/crear_tarea", methods=["POST"])
def crear_tarea():
    data = request.get_json()
    clave = data.get("clave", "").strip()

    if clave != "Sanlorenzo":
        return jsonify({"success": False, "message": "⚠️ Contraseña incorrecta."})

    campos = [
        "fecha", "ut", "tarea", "tipo", "ajuste", "horario", "lugar", "marca", "modelo",
        "pedido", "responsable", "lado", "cuenta",
        "tx_zona", "rx_zona", "tx_protection", "rx_protection",
        "estado", "comentario"
    ]

    try:
        with get_connection() as conn:
            with closing(conn.cursor()) as cursor:
                columnas = ", ".join(campos)
                placeholders = ", ".join(["?"] * len(campos))
                valores = [data.get(c) for c in campos]
                cursor.execute(f"INSERT INTO tarea ({columnas}) VALUES ({placeholders})", valores)
                conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        app.logger.exception("Error creando nueva tarea")
        return jsonify({"success": False, "message": str(e)}), 500

# -----------------------------------------------------------------------------
# API: CROMO
# -----------------------------------------------------------------------------
@app.get("/api/cromo")
def api_cromo():
    lado = (request.args.get("lado") or "").strip()
    if not lado:
        return jsonify({"success": False, "message": "Falta 'lado'"}), 400

    lado_norm = lado.replace(" ", "").replace("-", "")

    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("PRAGMA table_info(ruta)")
            nombres = {row["name"].lower() for row in cur.fetchall()}
            ruta_col = None
            for cand in ("carpeta", "ruta", "path", "directorio", "folder"):
                if cand in nombres:
                    ruta_col = cand
                    break

            if ruta_col:
                sql = f"""
                    SELECT c.*, r.{ruta_col} AS Carpeta
                      FROM cromo c
                      LEFT JOIN ruta r
                        ON CAST(r.UT AS TEXT) = CAST(c.UT AS TEXT)
                     WHERE REPLACE(REPLACE(c.Lado,'-',''),' ','') = ?
                """
            else:
                sql = """
                    SELECT c.*, NULL AS Carpeta
                      FROM cromo c
                     WHERE REPLACE(REPLACE(c.Lado,'-',''),' ','') = ?
                """

            cur.execute(sql, (lado_norm,))
            rows = cur.fetchall()

        items = []
        for r in rows:
            keys = r.keys()
            conexion = r["Conexión"] if "Conexión" in keys else (r["Conexion"] if "Conexion" in keys else None)
            items.append({
                "UT":       r["UT"],
                "Cuenta":   r["Cuenta"],
                "Lado":     r["Lado"],
                "Clase":    r["Clase"],
                "Celda":    r["Celda"],
                "Conexion": conexion,
                "Carpeta":  r["Carpeta"],
            })
        return jsonify({"success": True, "items": items})
    except Exception as e:
        app.logger.exception("Error en /api/cromo")
        return jsonify({"success": False, "message": "DB error", "detail": str(e)}), 500

# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
if __name__ == '__main__':
    print("Ruta absoluta DB:", os.path.abspath(DB_PATH))
    print("¿Existe DB?", os.path.exists(DB_PATH))
    app.logger.info(f"Ruta DB: {os.path.abspath(DB_PATH)} | Existe: {'Sí' if os.path.exists(DB_PATH) else 'No'}")
    app.run(host='0.0.0.0', port=5000, debug=True)
    #serve(app, host="0.0.0.0", port=5000)
