# Fase 0 · Auditoría y plan

Fecha: 2026-09-17 · Repo: `ads-studio` (main `4586bd0`) · Producción: rotulados.conluismz.com (Coolify)
Especificación: [prototipo/nova-studio-de-ads.html](prototipo/nova-studio-de-ads.html)

## 1. Stack real

| Capa | Hoy | Observación |
|---|---|---|
| Frontend | React 18 + Vite 6 + Tailwind 3, `lucide-react`, `chart.js`. Un solo componente [`nova-ads-studio.jsx`](../nova-ads-studio.jsx) (940 líneas) + [`src/fatiga/`](../src/fatiga) (motor propio, vista con Chart.js, cargada bajo demanda). | Sin router ni gestor de estado: `useState` + `window.storage`. |
| Backend | Express 4 (ESM, Node 24). [`server/index.js`](../server/index.js) sirve el API y el `dist/`. | Sin capa de modelos: el API es un **kv** (`GET/PUT/DELETE /api/kv?key=`). |
| Base de datos | Almacén clave‑valor: SQLite (`better-sqlite3`) o Postgres (`pg`) si hay `DATABASE_URL`. Tablas `kv(key,value,updated_at)` y `meta`. | Producción usa SQLite en `/data/nova.db`. Por lo que vimos (datos que volvieron al ejemplo tras un deploy) **el volumen no está montado**. |
| Archivos | S3 opcional (`S3_BUCKET`, `server/blobs.js`); si no, data URL dentro de la base. Solo miniaturas ≤ 640 px; se sirven por `/api/img` con sesión. | No hay subida de videos ni de originales. |
| Colas | Ninguna. | La "sincronización con Meta" es un buzón (`/api/sync`) que atiende Claude por MCP con `SYNC_TOKEN` + polling del navegador. |
| Auth | Una contraseña (`APP_PASSWORD`), cookie HMAC 30 días, rate limit por IP. Sin usuarios ni tenants. | Los endpoints de agente usan `Bearer SYNC_TOKEN`. |
| Despliegue | Dockerfile multi‑stage, build pack Dockerfile en Coolify, healthcheck `/api/health`. | En prod faltan `SYNC_TOKEN`, `DATABASE_URL`, `S3_*` y el volumen. |
| Tests | Ninguno (ni framework). | |
| Multi‑tenant | No. Un "producto" es un filtro por texto (`PRODUCTOS = [NOVAFLEX, NOVAFIT, KLYNEA, XTRICK, Nova Shop]`). | No hay aislamiento que respetar; sí hay que introducir `producto` como entidad. |

## 2. Cómo está modelado hoy

Tres claves JSON en `kv`, sin relaciones:

**`nova-ads:all:v1`** (guiones `SCR_###`): `{ id, num, fecha "dd/mm/aaaa", concepto (título), producto, formato (UGC|TESTI|DEMO|…15 códigos), ccr (PROBSOL|TRANSF|…15), angulo (DOLOR|PADRES|…9 o texto), variant, hook, body, cta, clips, notas, estado (guion|vo|edicion|lanzado|testing|ganador|muerto), spend (S/), pedidos, meta? {compras, impresiones, clics, ctr, cuentas, periodo, syncedAt} }`. Nombre del anuncio derivado: `AD_{PRODUCTO}_{FORMATO}_{CCR}_{ANGULO}_{###}_{VAR}`.

**`nova-refs:list:v1`** (Banco): `{ id, fecha, titulo, tipo (idea|video|imagen|competencia|hook), producto, angulo (texto libre), fuente, url, imgUrl, imgKey, rescatar[], notas, tags[], rating, estado (nueva|probar|convertida…) }`. Imagen en `nova-refimg:{id}` (data URL o puntero `s3:`).

**Ganadores** = filtro `estado === "ganador"` (marcado a mano). **Métricas** = tasa de acierto y ranking de ganadores por ángulo/formato/concepto. **Fatiga** (`nova-fatiga:datos:v1`, global, no por producto) con motor propio escrito desde el PDF, entrada por CSV o por Claude.

## 3. Mapa: existe vs pide el prototipo

| Área del prototipo | Hoy | Brecha |
|---|---|---|
| Producto (selector, código, ficha para prompts) | Constante + filtro | Entidad nueva con `brief`. |
| Ángulos por producto (nombre, deseo, a quién, etapa) | Vocabulario fijo de 9 códigos | Entidad nueva. Hay que **mapear códigos → ángulos**. |
| Conceptos compartidos | 15 códigos fijos (`ccr`) | Entidad. Se pueden sembrar con los 15 actuales. |
| Hooks (tipo, origen, ángulo, concepto, etapa) | Campo `hook` dentro del guion + refs tipo "hook" | Entidad nueva; se pueden extraer de los guiones y del banco. |
| Pieza con guion por bloques, copy, creativos, etapa TOFU/MOFU/BOFU, pizarra | Guion plano hook/body/cta, sin creativos, sin etapa de embudo | Rediseño del modelo. Migración: hook/body/cta → 3 bloques. |
| Pipeline Idea→Guion→Producción→Lanzado→Testing→Resultado (automático) | Guión→VO→Edición→Lanzado→Testing→Ganador/Muerto (manual) | Cambio de estados; **Ganador/Muerto manual choca con la regla** (ver dudas). |
| Formatos: video, video_texto, imagen, carrusel | 15 formatos de producción (UGC, TESTI…) | Choca con la nomenclatura actual (ver dudas). |
| Biblioteca con archivos, pegar, extracción, búsqueda en OCR/transcripción | Banco con miniaturas y notas | Fase 2‑3 completas: subida de originales, ffmpeg, Whisper, OCR, cola. |
| Endpoint Nova Swipe | No existe | Nuevo, con token propio. |
| Prompts de IA (plantillas editables, pegar JSON, opcional API) | No existe | Nuevo. |
| Embudo / pizarra | No existe | Nuevo. |
| Datos de Meta (CSV + Marketing API) | CSV parcial (`normalizar.js`) + buzón Claude | Tablas propias, reimportación sin duplicar, sync diario con token. |
| Análisis 80/20 | No existe | Nuevo (prototipo lo tiene completo). |
| Fatiga con `MotorFatiga` | Motor **propio** + vista propia | Reemplazar el motor por `MotorFatiga` sin tocar su lógica; adaptar la vista. |
| Tracker (CPA real por etapa/ángulo, resultados) | Métricas + Ganadores | Se absorben en Tracker. |
| Ajustes (tope USD, TC, muestra, Whisper, cuenta) | Solo variables de entorno | Nuevo, con secretos cifrados. |

Lo que sí se conserva: login por contraseña, capa S3, soporte Postgres, Dockerfile/Coolify, botón "Copiar guión", y el CSV normalizador como base de la importación.

## 4. Modelo de datos propuesto (Postgres, migraciones SQL versionadas)

Nombres en español, `id` texto (ULID) para poder conservar los ids actuales. Todo con `creado_en / actualizado_en`.

| Tabla | Campos clave |
|---|---|
| `producto` | id, nombre, codigo (único), ficha (text), tope_usd?, activo |
| `angulo` | id, producto_id FK, nombre, deseo, descripcion, etapa (TOFU/MOFU/BOFU/null), codigo_legado |
| `concepto` | id, nombre (único), codigo_legado |
| `hook` | id, producto_id, texto, tipo, angulo_id?, concepto_id?, etapa?, origen |
| `referencia` | id, producto_id, archivo_id?, tipo (video/imagen/enlace), marca, fuente, enlace, formato, concepto_id?, angulo_id?, etapa?, coleccion, calificacion (1‑5), notas, **campos legado**: titulo, tipo_banco, rescatar[], tags[], estado_banco |
| `extraccion` | referencia_id PK, estado, error, duracion, fotogramas jsonb [{t, archivo_id}], transcripcion jsonb, ocr jsonb, bloques jsonb, analisis jsonb, hecho_en |
| `pieza` | id, producto_id, numero (único por producto), codigo `SCR_###`, titulo, formato (video/video_texto/imagen/carrusel), estado (idea/guion/produccion/lanzado/testing), etapa?, angulo_id?, concepto_id?, hook_id?, referencia_id?, nombre_anuncio, nombre_bloqueado bool, portada_archivo_id?, board_x, board_y, gasto, confirmados, entregados, clips, notas, **legado**: formato_produccion (UGC…), variante, resultado_manual? |
| `pieza_bloque` | id, pieza_id, orden, tipo, tiempo, voz, texto_pantalla, visual |
| `pieza_copy` | pieza_id PK, texto_principal, titulo, cta, mensaje_whatsapp, hooks_alternativos jsonb |
| `pieza_archivo` | pieza_id, archivo_id, orden |
| `pieza_anuncio_meta` | pieza_id, meta_ad_id (único) |
| `archivo` | id, clave_s3, tipo_mime, clase (video/imagen/fotograma/miniatura), nombre, bytes, ancho, alto, duracion, miniatura_archivo_id?, subido_en |
| `carril_embudo` | producto_id, etapa PK, objetivo, publicos jsonb |
| `meta_cuenta` | id (act_…), nombre, moneda, producto_id? |
| `meta_anuncio` | id (ad id de Meta), cuenta_id, nombre, campana, conjunto, fecha_inicio, frecuencia_acumulada, formato_inferido, producto_id (asignado por código en campaña) |
| `meta_anuncio_dia` | anuncio_id + fecha PK, gasto, impresiones, alcance, clics, resultados, valor, vistas_3s, fuente (csv/api), importado_en |
| `ajuste` | clave PK, valor jsonb, cifrado bool |
| `secreto` | clave PK, valor_cifrado (AES‑256‑GCM con `SECRETS_KEY` del entorno) |
| `tarea` | id, tipo, referencia_id?, estado, progreso, mensaje, intentos, creado/terminado (la cola vive en `pg-boss`; esta tabla es la vista para la UI) |
| `plantilla_prompt` | clave PK (guion_pieza / desglose_referencia), texto, actualizado_en |
| `token_api` | id, nombre (nova-swipe, sync-claude), hash, ultimo_uso |

Reglas de negocio derivadas (no se guardan): CPA real, resultado (TBD/Ganador/Perdedor), concepto validado, nombre sugerido, núcleo 80/20, matriz de fatiga (`MotorFatiga`).

## 5. Migración de datos existentes (reversible)

Orden, en una sola transacción, con respaldo previo `/api/export` y copia de `nova.db`:

1. **Productos**: uno por cada valor distinto de `producto` en ads y refs, más los de `PRODUCTOS`. `codigo` = token actual (NOVAFLEX, NOVAFIT, KLYNEA, XTRICK, NOVASHOP). Ficha vacía.
2. **Conceptos**: los 15 `CONCEPTOS` (guardan `codigo_legado`). **Ángulos**: por producto, uno por cada código de `ANGULOS` usado en sus guiones (más los libres). **Hooks**: uno por guion con `hook` no vacío (origen "Propio", tipo "Hablado") y uno por referencia `tipo = hook`.
3. **Piezas**: 1:1 con cada guion. `numero`/`codigo` se conservan. `formato` según tabla: ESTATICA→imagen, CARRU→carrusel, SLIDE/MOTION/VOZOFF sin voz→**pregunta**, resto→video; el código original queda en `formato_produccion`. `estado`: guion→guion, vo/edicion→produccion, lanzado→lanzado, testing→testing, ganador/muerto→ver duda 2. Bloques: hook→"Hook 0–3 s", body→"Demostración", cta→"CTA". `gasto`=spend, `confirmados`=pedidos. `nombre_anuncio` = nombre actual (queda **bloqueado** si `meta.syncedAt` existe).
4. **Referencias**: 1:1 con el banco; `tipo` video/imagen/enlace según `tipo` y `url`; la miniatura pasa a `archivo` (subiendo a S3 lo que hoy es data URL). Campos que el prototipo no tiene (`rescatar`, `tags`, `estado`) se conservan como legado y se siguen mostrando.
5. **Meta**: `nova-fatiga:datos:v1` → `meta_anuncio` + `meta_anuncio_dia` (cuenta nova shop, USD). El bloque `meta` de cada ad (inversión sincronizada) no se migra a filas diarias; se conserva en `pieza.gasto` y en `pieza_anuncio_meta` si hay id.
6. Las claves `kv` **no se borran**; la migración inversa reconstruye los JSON desde las tablas. Un flag `migracion_v2_aplicada` en `meta` evita repetirla.

Estado real de producción: hoy muestra el dataset de ejemplo (SCR_001‑004, 3 refs); los guiones SCR_008‑012 se perdieron con un redeploy sin volumen. La migración sigue valiendo para local y para lo que cargues antes de la Fase 1.

## 6. Qué corre dónde

| Navegador | Servidor |
|---|---|
| UI, filtros, pizarra, editor de bloques, pegar archivos (solo captura el blob), `MotorFatiga` y 80/20 sobre datos que entrega `/api/meta/...` (datos ≤ 90 días por producto: unas 3‑5 mil filas, calcula en < 50 ms) | API REST por recurso, sesión, validación, reglas de negocio |
| Vista previa de video con URL firmada de lectura | Subida por **URL firmada PUT** a S3 (bucket privado, CORS), registro en `archivo` |
| Polling de estado de tareas (`/api/tareas/:id`) | **Cola `pg-boss`** (sobre Postgres, sin Redis) con worker en el mismo contenedor (`node server/worker.js`), reintentos y progreso |
| | **ffmpeg** (en la imagen Docker): miniatura, fotogramas cada ~3 s, extracción de audio 16 kHz |
| | **Whisper**: `faster-whisper` en un contenedor Python aparte (Coolify) o API externa — decisión tuya (duda 6) |
| | **OCR**: `tesseract.js` en Node (`spa+eng`), deduplicando textos casi iguales (misma lógica `similar()` del prototipo) |
| | **IA**: llamadas a Anthropic desde el servidor; plantillas en `plantilla_prompt`; parser tolerante a ```json |
| | **Meta**: importación CSV y sync diario (cron en el worker) con la Marketing API (`/act_{id}/insights`, level=ad, time_increment=1) |
| | Endpoint Nova Swipe y endpoints de agente con `token_api` |

Herramientas que propongo añadir: `kysely` (query builder + migraciones, JS puro; permite mantener SQLite solo para desarrollo), `pg-boss`, `@aws-sdk/s3-request-presigner`, `multer` no (subida directa), `vitest` + `supertest` para tests, `react-router-dom` y una división del componente en `src/views/*`. Postgres pasa a ser **obligatorio en producción**; la app falla al arrancar si falta `DATABASE_URL`, `SECRETS_KEY` o `APP_PASSWORD`.

## 7. Plan por fases (ajustado a lo que ya existe)

| Fase | Entrega | Base ya hecha |
|---|---|---|
| 1 | Esquema + migración, API REST, productos/ángulos/conceptos/hooks, pipeline nuevo, pieza con 3 pestañas, tests de reglas (CPA, resultado, nombre, concepto validado) | Login, Postgres, Dockerfile |
| 2 | `archivo` + S3 firmado, pegar/arrastrar, miniaturas ffmpeg, vista previa, enlaces, buscador, endpoint Nova Swipe | `blobs.js`, `/api/img` |
| 3 | Cola, extracción (fotogramas, Whisper, OCR), tramos editables, plantillas de prompt, aplicar JSON, "crear pieza con adaptación" | — |
| 4 | Pizarra de embudo y carriles | — |
| 5 | `meta_*`, importación CSV idempotente, sync Marketing API, asignación por código, vínculo anuncio‑pieza | `normalizar.js`, `scripts/fatiga-meta.mjs` |
| 6 | 80/20 y Fatiga con `MotorFatiga` portado a ES module + test contra `sample-nova` | `FatigaView.jsx` (la UI se adapta; el motor se reemplaza) |

## 8. Riesgos

1. **Nomenclatura**: la convención actual (`AD_PROD_FORMATO_CCR_ANGULO_###_VAR`) y la del prototipo (`AD_PROD_ANGULO_FORMATO_###_VAR`) no coinciden, y los anuncios reales en Meta usan otros nombres (`ad_viraltiktok_007_A`). Si cambiamos la convención, la sincronización por nombre deja de encontrar lo poco que encontraba. El vínculo por **ad id** (`pieza_anuncio_meta`) resuelve esto y es lo que propongo como fuente de verdad.
2. **Pérdida de datos en producción**: sin volumen ni Postgres, cada deploy borra la base. Hay que configurar `DATABASE_URL` (Postgres de Coolify) **antes** de la Fase 1.
3. **Recursos del servidor**: ffmpeg + Whisper en CPU en el VPS de Coolify puede tardar minutos por video y competir con la app. Por eso Whisper va en contenedor aparte o en API.
4. **Marketing API**: requiere app de Meta con `ads_read`, token de usuario del sistema y, para uso continuo, revisión de la app. Mientras tanto queda el CSV y el buzón de Claude.
5. **Refactor del componente único**: 940 líneas a varias vistas y API REST es el cambio más grande; se hace en la Fase 1 con la migración, no antes.
6. **`MotorFatiga` vs motor actual**: difieren en detalles (grupo "esperar", rendimiento sin resultados, pisos). Al reemplazarlo, los números de la pestaña Fatiga actual cambian; el test contra el fixture fija el comportamiento del prototipo como referencia.
7. **Moneda**: piezas en soles, cuentas de Meta en USD. Se guarda cada dato en su moneda y la conversión usa el tipo de cambio de Ajustes en el momento de mostrar (como el prototipo).

## 9. Dudas que necesito resueltas antes de la Fase 1

1. **Formatos**: ¿reducimos a los 4 del prototipo y guardo el formato de producción (UGC, TESTI…) como atributo secundario, o mantenemos los 15 como formato principal? Afecta nombre del anuncio y Tracker.
2. **Ganador/Muerto actuales**: la regla dice que no se marcan a mano. Para lo migrado propongo `resultado_manual` como "decisión histórica" (solo lectura, visible con etiqueta). ¿De acuerdo, o los paso a Testing y que el CPA decida?
3. **Nombre del anuncio**: ¿adoptamos la convención del prototipo `AD_[PRODUCTO]_[ANGULO]_[FORMATO]_[###]_[VARIANTE]` (sin concepto)?
4. **Productos**: "Nova Shop" es una cuenta, no un producto. ¿Lo elimino como producto y las piezas que lo usan pasan a…? ¿KLYNEA y XTRICK se mantienen?
5. **Postgres obligatorio** en producción y SQLite solo para desarrollo, ¿ok? (Alternativa: mantener ambos con Kysely, más trabajo en cada migración).
6. **Whisper**: (a) contenedor Python con `faster-whisper` en Coolify, (b) API externa (OpenAI/Groq, cuesta por minuto), (c) `transformers.js` en el worker de Node (más lento, sin dependencias). Recomiendo (a).
7. **Cola**: `pg-boss` sobre Postgres (sin Redis). ¿Ok?
8. **Métricas y Ganadores** actuales desaparecen como pestañas y se absorben en Tracker. ¿Ok?
9. **Buzón de Claude** (`/api/sync`, skill `sync-meta`): ¿lo mantengo como vía alternativa hasta que exista el token de la Marketing API, o lo retiro en la Fase 5?
10. **Referencias legado** (`rescatar`, `tags`, `estado` nueva/probar/convertida): ¿se conservan visibles o se dejan solo en la base?
