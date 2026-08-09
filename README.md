# NOVA · Studio de Ads

Aplicación autoalojada para gestionar la producción de anuncios: banco de referencias, pipeline de guiones, seguimiento de ganadores y métricas de acierto.

Pensada para equipos que iteran creativos en Meta / TikTok y necesitan una nomenclatura consistente y datos sobre qué ángulos, formatos y conceptos realmente funcionan.

Los datos viven en **SQLite en tu servidor** y el acceso está protegido por **una contraseña que defines por variable de entorno**.

## Qué incluye

**Pipeline** — Tablero o lista con los estados por los que pasa cada ad:

| Estado | Significado |
|---|---|
| Guión | Escrito, sin aprobar |
| Voz / VO | Aprobado y generado |
| Edición | En corte / montaje |
| Lanzado | En Meta / TikTok |
| Testing | Midiendo CPA real |
| Ganador | Escala / itera |
| Muerto | Descartado |

**Banco** — Referencias guardadas (con imagen o enlace) que se convierten en guiones con un clic.

**Ganadores** — Vista filtrada de los ads que escalaron.

**Métricas** — Tasa de acierto y ranking de los ángulos, formatos y conceptos que más ganadores producen.

## Nomenclatura automática

Cada ad recibe un nombre generado a partir de su taxonomía, para que el naming sea idéntico en la plataforma de ads y en los reportes:

```
AD_{PRODUCTO}_{FORMATO}_{CCR}_{ANGULO}_{###}_{VARIANTE}
```

Por ejemplo: `AD_NOVAFLEX_UGC_PROBSOL_DOLOR_007_B`

La taxonomía trae vocabularios controlados para **formatos** (UGC, TESTI, DEMO, VSL, ANTDES…), **conceptos** (PROBSOL, TRANSF, HISTORIA, EDUCA…) y **ángulos**, de modo que las métricas se agrupen sin ruido.

## Arquitectura

Un solo contenedor: Express sirve el API y también el frontend ya compilado.

```
Navegador ── Gate (contraseña) ── App React
                  │                  │
                  │            window.storage
                  ▼                  ▼
            POST /api/login    GET/PUT/DELETE /api/kv
                  └──────── cookie firmada ────────┘
                                     │
                                  SQLite  (/data/nova.db)
```

`nova-ads-studio.jsx` guarda todo a través de `window.storage`, una API async de tres métodos. [src/storage.js](src/storage.js) implementa esa misma interfaz contra el servidor, así que **el componente no tuvo que modificarse** y la interfaz quedó idéntica.

La base es un almacén clave-valor (tabla `kv`) con tres claves:

- `nova-ads:all:v1` — ads y guiones
- `nova-refs:list:v1` — referencias del banco
- `nova-refimg:{id}` — miniaturas (redimensionadas a 640px y comprimidas a JPEG antes de guardar)

### API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Healthcheck (sin auth) |
| `GET` | `/api/session` | `{ authenticated: bool }` |
| `POST` | `/api/login` | `{ password }` → cookie de sesión |
| `POST` | `/api/logout` | Cierra la sesión |
| `GET` | `/api/kv?key=…` | Lee una clave |
| `PUT` | `/api/kv?key=…` | Escribe `{ value }` |
| `DELETE` | `/api/kv?key=…` | Borra una clave |
| `GET` | `/api/export` | Descarga toda la base en JSON |

Todo bajo `/api/kv` exige la cookie. El login compara en tiempo constante y corta a los 10 intentos fallidos por IP en 15 minutos.

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `APP_PASSWORD` | **Sí** | Contraseña de acceso. El servidor no arranca sin ella. |
| `SESSION_SECRET` | No | Firma la cookie. Si falta se genera y se guarda en la base. Cambiarlo cierra la sesión en todos los dispositivos. |
| `DB_PATH` | No | Ruta del archivo SQLite. Por defecto `./data/nova.db`. |
| `PORT` | No | Puerto del servidor. Por defecto `3000`. |
| `COOKIE_SECURE` | No | Fuerza la cookie `secure`. Normalmente se detecta solo tras el proxy. |

Ver [.env.example](.env.example).

## Desplegar en Coolify

1. **New Resource → Application → Public/Private Repository**, apuntando a este repo.
2. Build Pack: **Dockerfile**.
3. **Environment Variables**:
   - `APP_PASSWORD` → tu contraseña.
   - `SESSION_SECRET` → salida de `openssl rand -hex 32`.
   - `DB_PATH` → `/data/nova.db`.
4. **Storages → Add**: volumen persistente montado en `/data`.

   Este paso no es opcional: sin el volumen, SQLite vive dentro del contenedor y **se borra en cada redeploy**.
5. Puerto expuesto: `3000`. Asigna el dominio y activa HTTPS.
6. Deploy.

Para respaldar, entra a la app y descarga `/api/export`, o copia `/data/nova.db` desde el volumen.

## Desarrollo local

Requiere Node 20+.

```bash
npm install
cp .env.example .env      # define al menos APP_PASSWORD
npm run dev
```

Levanta el API en `:3000` y Vite en `:5173` con proxy de `/api`. La base queda en `./data/nova.db`.

Para probar el build de producción:

```bash
npm run build && npm start   # todo en http://localhost:3000
```

## Estructura

```
nova-ads-studio.jsx   Componente de la app (sin modificar)
index.html            Punto de entrada de Vite
src/
  main.jsx            Instala window.storage, decide gate vs app
  Gate.jsx            Pantalla de contraseña
  storage.js          window.storage respaldado por el servidor + sesión
  index.css           Tailwind + fuente Inter
server/
  index.js            Express: rutas, estáticos, SPA fallback
  db.js               SQLite (tabla kv) y secreto de sesión
  auth.js             Cookie firmada, comparación constante, rate limit
Dockerfile            Build multi-etapa
docker-compose.yml    Alternativa a Dockerfile, con volumen declarado
```
