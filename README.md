# NOVA · Studio de Ads

Aplicación autoalojada para gestionar la producción de anuncios: banco de referencias, pipeline de guiones, seguimiento de ganadores y métricas de acierto.

Pensada para equipos que iteran creativos en Meta / TikTok y necesitan una nomenclatura consistente y datos sobre qué ángulos, formatos y conceptos realmente funcionan.

Los datos viven en **Postgres** (o SQLite si no configuras uno), las imágenes en **AWS S3** (opcional) y el acceso está protegido por **una contraseña que defines por variable de entorno**.

## Qué incluye

La interfaz sigue el prototipo de [docs/prototipo/nova-studio-de-ads.html](docs/prototipo/nova-studio-de-ads.html). Barra lateral por flujo:

- **Crear** · **Ideas de contenido**, **Biblioteca** (anuncios de otras marcas por fuente, colección y marca, con su ID; subir, arrastrar, pegar con Ctrl+V o capturar con la extensión **Nova Swipe**; desglose con IA), **Ángulos de venta**, **Conceptos** y **Hooks**.
- **Guion automático** · Todo lo que llega con archivo se extrae solo, de a uno (se apaga en Ajustes): fotogramas, transcripción de la voz y lectura del texto en pantalla. La lectura aísla las letras y filtra por confianza; lo que sale dudoso no se mezcla con el guion, queda aparte como “texto en pantalla ilegible · ver lo leído” y se puede aceptar o borrar. Si el lector de texto falla, igual se guarda la voz.
- **Ficha del anuncio** · Guion en modo leer o editar con el hook arriba y sus estadísticas (duración, tramos, palabras por minuto, textos legibles), **storyboard** en 3, 4 o 6 columnas que se copia o se descarga como imagen, señal de días activo, clasificación por chips con sugerencias, copy del anuncio (primera línea como hook, título, descripción, botón y a dónde lleva) y origen con ID y enlace.
- **Producir** · **Pipeline** Idea → Guion → Producción → Lanzado → Testing → Resultado. Cada pieza tiene guion por bloques, creativos y copy, y resultados. El resultado (Ganador / Perdedor / TBD) lo decide el CPA real contra el tope al llegar a la muestra mínima.
- **Lanzar** · **Embudo**: pizarra TOFU / MOFU / BOFU con objetivo y públicos por etapa.
- **Medir** · **Análisis 80/20**, **Fatiga** (motor `MotorFatiga` del predictor) y **Tracker** de CPA real.

Todo se filtra por producto (NOVAFLEX, NovaFit Pro…), salvo los conceptos. Los datos de Meta llegan por **Importar datos de Meta** (CSV del Administrador de anuncios) o los envía Claude (ver abajo).

Las piezas migradas que estaban marcadas a mano como Ganador o Muerto muestran la etiqueta *Histórico*; es informativa y no cambia el resultado.

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
                     Postgres (DATABASE_URL) ─┴─ S3 (imágenes)
                     o SQLite (/data/nova.db)
```

El Studio ([src/studio/](src/studio)) guarda a través de [persistencia.js](src/studio/persistencia.js), que usa `window.storage` ([src/storage.js](src/storage.js)) contra `/api/kv` y sube los archivos a `/api/media`.

La base tiene un almacén clave-valor (tabla `kv`) y una tabla `blob` para archivos cuando no hay S3. Claves del Studio:

- `studio:state:v2` — productos, ángulos, conceptos, hooks, piezas, biblioteca, embudo y ajustes
- `studio:metadata:v2` — datos diarios de Meta por producto (se reescribe solo si cambian)
- `studio:media:{id}` — metadatos de cada archivo (miniatura, tipo, duración); los bytes van a `/api/media/{id}`
- `nova-fatiga:datos:v1` — datos que envía Claude; el Studio los importa al abrirse

Claves de la versión anterior (`nova-ads:all:v1`, `nova-refs:list:v1`, `nova-refimg:*`) se migran solas la primera vez que se abre el Studio con la base vacía y no se borran.

### Imágenes en S3

Con `S3_BUCKET` definido, el servidor sube cada miniatura al bucket (`{S3_PREFIX}/refimg/{id}/{timestamp}.jpg`) y en la base guarda solo el puntero `s3:…`. Al leerla, el navegador recibe `/api/img?key=…`, que el servidor sirve desde S3 tras validar la sesión: **el bucket puede (y debe) quedar privado**. Al reemplazar o borrar una imagen se borra también el objeto anterior.

Sin S3 las imágenes se guardan dentro de la base como antes, y las que ya estaban así se siguen mostrando aunque luego actives S3.

Permisos IAM mínimos sobre el bucket: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` (y `s3:ListBucket` si quieres que el chequeo de arranque no muestre aviso).

### Datos por defecto al pasar a Postgres

Al arrancar con un Postgres **vacío**, el servidor copia todo lo que haya en el SQLite de `DB_PATH` (o `SQLITE_IMPORT_PATH`): guiones, banco, imágenes (que suben a S3 si está configurado) y el secreto de sesión, así nadie tiene que volver a entrar. Es una sola transacción y nunca corre si la base ya tiene datos.

Si no hay SQLite que importar, la app carga sus datos de ejemplo la primera vez.

### Extensión Nova Swipe

Extensión de Chrome ([extension/](extension)) que guarda anuncios en la Biblioteca desde la Biblioteca de anuncios de Meta, TikTok, Instagram, Facebook, YouTube o cualquier web:

- **Botón «Guardar» sobre el contenido**: aparece al pasar el mouse por cualquier video o imagen y lo envía con un clic (se puede desactivar en las opciones).
- **Clic derecho → Guardar en Nova Studio** sobre un anuncio, video, imagen o enlace.
- **Ícono de la extensión**: muestra el contenido principal de la página ya elegido, con marca e ID; producto, fuente, colección y otros archivos son opcionales.
- **ID + marca automáticos**: Biblioteca de Meta (ID de la biblioteca, anunciante, fecha, texto, título, descripción, botón y a dónde lleva), TikTok (ID del video y @cuenta), Instagram (código del post o reel y @cuenta), Facebook (ID del video o post y página) y YouTube (ID y canal).
- **TikTok**: el video se obtiene de los datos de la página del video y se descarga con el `Referer` que exige TikTok (regla de `declarativeNetRequest` solo para las descargas de la extensión). Instagram y Facebook, que reproducen por partes, se toman del último video descargado por la página.

Se descarga desde **Biblioteca → Descargar extensión** (`/api/swipe/extension.zip?config=1`), ya con la dirección del Studio y la clave. Instalación: `chrome://extensions` → Modo de desarrollador → Cargar descomprimida. Para Chrome Web Store hay una versión sin clave.

Flujo: la extensión sube el archivo a `/api/swipe/media/{id}` y el anuncio a `/api/swipe/items` con `Authorization: Bearer <clave>`. Todo queda en una bandeja (`studio:inbox:v1`); el Studio abierto la revisa cada 15 s, genera las miniaturas, agrega los anuncios en **Por clasificar** y la vacía. Así el servidor nunca reescribe el estado que el navegador está editando. La clave vive en la base (`meta.swipe_token`) y se regenera desde la misma ventana.

### Sincronización con Meta vía Claude

La app no guarda credenciales de Meta. Claude (con el MCP de Meta Ads y la skill [`/sync-meta`](.claude/skills/sync-meta/SKILL.md)) lee 90 días de métricas diarias por anuncio, las convierte con [scripts/fatiga-meta.mjs](scripts/fatiga-meta.mjs) sin transcribir números y las envía a `/api/sync/agent/fatiga`. El servidor las guarda en `nova-fatiga:datos:v1` y el Studio las importa al abrirse (asigna cada anuncio al producto cuyo código aparece en la campaña).

Requisitos: `SYNC_TOKEN` en el servidor y, donde corre Claude, `NOVA_URL` + `SYNC_TOKEN` en el `.env`. Pídele a Claude "sincroniza la fatiga de <cuenta>".

`/api/sync` conserva además el canal de solicitudes (pendiente → procesando → listo) para automatizaciones.

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
| `GET` | `/api/img?key=…` | Sirve una imagen del banco (desde S3 o la base) |
| `GET` / `POST` | `/api/sync` | Estado de la sincronización / pedir una nueva |
| `GET` | `/api/sync/agent` | Solicitud actual con la lista de ads (token) |
| `POST` | `/api/sync/agent/claim` | Marca la solicitud como en proceso (token) |
| `POST` | `/api/sync/agent/result` | Envía resultados o error (token) |
| `POST` | `/api/sync/agent/fatiga` | Envía datos de fatiga sin solicitud previa (token) |
| `DELETE` | `/api/sync` | Cancela la solicitud abierta |
| `PUT` / `GET` / `DELETE` | `/api/media/{id}` | Archivos del Studio (S3 o base) |
| `GET` | `/api/swipe/status` | Clave de Nova Swipe, último envío y pendientes |
| `POST` | `/api/swipe/token` | Regenera la clave |
| `GET` | `/api/swipe/extension.zip` | Descarga la extensión (`?config=1` con dirección y clave) |
| `GET` / `POST` | `/api/inbox`, `/api/inbox/ack` | Bandeja de lo que envió la extensión |
| `GET` | `/api/swipe/ping`, `/api/swipe/products` | Para la extensión (clave) |
| `PUT` / `POST` | `/api/swipe/media/{id}`, `/api/swipe/items` | Envíos de la extensión (clave) |
| `GET` | `/api/export` | Descarga toda la base en JSON (las imágenes en S3 salen como puntero) |

Todo bajo `/api/kv`, `/api/img` y `/api/sync` exige la cookie, salvo `/api/sync/agent*`, que exige `Authorization: Bearer $SYNC_TOKEN`. El login compara en tiempo constante y corta a los 10 intentos fallidos por IP en 15 minutos.

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `APP_PASSWORD` | **Sí** | Contraseña de acceso. El servidor no arranca sin ella. |
| `SESSION_SECRET` | No | Firma la cookie. Si falta se genera y se guarda en la base. Cambiarlo cierra la sesión en todos los dispositivos. |
| `DATABASE_URL` | No | Conexión a Postgres (`postgres://usuario:clave@host:5432/db`). Si falta se usa SQLite. |
| `DATABASE_SSL` | No | `require` (TLS sin validar certificado, típico en RDS), `verify` o `false`. Si lo usas, no pongas `sslmode` en la URL. |
| `DB_PATH` | No | Archivo SQLite. Por defecto `./data/nova.db`. Con Postgres, es lo que se importa la primera vez. |
| `SQLITE_IMPORT_PATH` | No | Importar desde otro archivo SQLite en vez de `DB_PATH`. |
| `SYNC_TOKEN` | Para sincronizar | Clave con la que Claude envía los datos de Meta. Sin ella el servidor rechaza los envíos. |
| `S3_BUCKET` | No | Bucket para videos e imágenes. Si falta, van dentro de la base. |
| `MEDIA_MAX_MB` | No | Tamaño máximo por archivo subido. Por defecto `300`. |
| `S3_REGION` | No | Región del bucket. Por defecto `AWS_REGION` o `us-east-1`. |
| `S3_PREFIX` | No | Carpeta dentro del bucket (ej. `nova`). |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Con S3 | Credenciales IAM. No hacen falta si corre en AWS con un rol. |
| `S3_ENDPOINT` / `S3_FORCE_PATH_STYLE` | No | Para servicios compatibles con S3 (MinIO, R2, Spaces). |
| `PORT` | No | Puerto del servidor. Por defecto `3000`. |
| `COOKIE_SECURE` | No | Fuerza la cookie `secure`. Normalmente se detecta solo tras el proxy. |

Ver [.env.example](.env.example).

## Desplegar en Coolify

1. **New Resource → Application → Public/Private Repository**, apuntando a este repo.
2. Build Pack: **Dockerfile** (no Docker Compose: el volumen, el puerto y las
   variables se configuran desde la interfaz de Coolify).
3. **Environment Variables**:
   - `APP_PASSWORD` → tu contraseña.
   - `SESSION_SECRET` → salida de `openssl rand -hex 32`.
   - `DB_PATH` → `/data/nova.db`.
   - `DATABASE_URL` (y `DATABASE_SSL` si hace falta) → tu Postgres. En Coolify puedes crear uno con **New Resource → Database → PostgreSQL** y copiar su URL interna.
   - `S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` → tu bucket de S3.
   - `SYNC_TOKEN` → salida de `openssl rand -hex 32`, para que Claude envíe los datos de Meta.
4. **Storages → Add**: volumen persistente montado en `/data`.

   Sin Postgres este paso no es opcional: SQLite viviría dentro del contenedor y **se borraría en cada redeploy**. Con Postgres, mantén el volumen al menos en el primer deploy: de ahí se importan tus datos actuales.
5. Puerto expuesto: `3000`. Asigna el dominio y activa HTTPS.
6. Deploy. En los logs verás qué base y qué almacenamiento de imágenes quedaron activos, y si se importó el SQLite.

Para respaldar: `pg_dump` (o los backups de Coolify / RDS) para la base y el versionado del bucket para las imágenes. `/api/export` sigue disponible como respaldo rápido de los datos.

## Desarrollo local

Requiere Node 20+.

```bash
npm install
cp .env.example .env      # define al menos APP_PASSWORD
npm run dev
```

Levanta el API en `:3000` y Vite en `:5173` con proxy de `/api`. Sin `DATABASE_URL` la base queda en `./data/nova.db`.

Para probar el build de producción:

```bash
npm run build && npm start   # todo en http://localhost:3000
```

## Estructura

```
index.html            Punto de entrada de Vite
docs/
  prototipo/          Prototipo de referencia (diseño y funciones)
  fase-0-auditoria.md Auditoría y plan por fases
src/
  main.jsx            Instala window.storage; pantalla de acceso y arranque del Studio
  Gate.jsx            Pantalla de contraseña (Tailwind)
  storage.js          window.storage respaldado por el servidor + sesión
  index.css           Tailwind + fuente Inter
  studio/
    app.js            Studio (portado del prototipo)
    persistencia.js   Guardado en el servidor y migración de la versión anterior
    motor-fatiga.js   MotorFatiga del predictor (lógica sin cambios)
    studio.css        Estilos del Studio
    skeleton.html     Estructura base del documento
    sample-nova.json  Ejemplo real: nova shop, 90 días
server/
  index.js            Express: rutas, estáticos, SPA fallback
  auth.js             Cookie firmada, comparación constante, rate limit
  db.js               Almacén kv y archivos: Postgres o SQLite; secreto de sesión
  media.js            /api/media: archivos en S3 o en la base
  blobs.js            Cliente S3
  images.js           Imágenes de la versión anterior: data URL <-> S3
  migrate.js          Importa el SQLite a un Postgres vacío
  sync.js             Canal con Claude (/api/sync)
extension/            Nova Swipe (Chrome, Manifest V3)
  background.js       Menú contextual y envío al Studio
  content.js          Detecta videos, imágenes y datos del anuncio
  popup.*, options.*  Ventana de la extensión y conexión
server/swipe.js y zip.js: clave, bandeja y descarga de la extensión
scripts/
  fatiga-meta.mjs     Convierte respuestas del MCP de Meta y las envía
.claude/skills/sync-meta/
  SKILL.md            Cómo Claude sincroniza con Meta Ads
Dockerfile            Build multi-etapa
docker-compose.yml    Alternativa a Dockerfile, con volumen declarado
```
