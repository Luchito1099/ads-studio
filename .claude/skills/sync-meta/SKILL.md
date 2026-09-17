---
name: sync-meta
description: Sincroniza NOVA Studio con Meta Ads vía MCP. Envía los datos diarios por anuncio que usan Análisis 80/20 y Fatiga, y atiende las solicitudes pendientes de /api/sync. Úsalo cuando el usuario diga "sincroniza", "sincroniza la fatiga", "/sync-meta" o cuando una rutina lo invoque.
---

# Sincronizar NOVA Studio con Meta Ads

La app no tiene credenciales de Meta. Deja una solicitud en `/api/sync` y tú la resuelves con el MCP de Meta Ads. El contrato del servidor está en `server/sync.js`.

## 0. Configuración

Lee de las variables de entorno o, si no están, del archivo `.env` en la raíz del repo:

- `NOVA_URL`: URL pública de la app, sin `/` final (ej. `https://ads.midominio.com`).
- `SYNC_TOKEN`: el mismo valor configurado en el servidor.
- `SYNC_USD_PEN`: tipo de cambio para cuentas en USD (ej. `3.75`). Opcional.

Si falta `NOVA_URL` o `SYNC_TOKEN`, detente y dile al usuario qué falta. Nunca muestres el token en la respuesta.

Todas las llamadas llevan `-H "Authorization: Bearer $SYNC_TOKEN"`.

## 1. Tomar la solicitud

```bash
curl -s "$NOVA_URL/api/sync/agent" -H "Authorization: Bearer $SYNC_TOKEN"
```

- Si `status` no es `pendiente`: no hay nada que hacer. Dilo en una línea y termina (en una rutina, termina sin más).
- Si es `pendiente`, reclámala con su `id` (si responde 409, otro agente la tomó: termina):

```bash
curl -s -X POST "$NOVA_URL/api/sync/agent/claim" -H "Authorization: Bearer $SYNC_TOKEN" \
  -H "Content-Type: application/json" -d '{"id":"<id>"}'
```

Mira el campo `tipo`:

- `inversion` (o sin `tipo`): sigue con los pasos 2 y 3 de abajo.
- `fatiga`: salta a la sección **Solicitud de fatiga** al final.

`ads` trae la lista `[{ id, nombre }]`. `nombre` es el nombre exacto del ad en Meta (ej. `AD_NOVAFLEX_UGC_PROBSOL_DOLOR_008_A`).

## 2. Consultar Meta

1. `ads_get_ad_accounts`: usa solo las cuentas con `is_ads_mcp_enabled` y `is_queryable` en `true`.
2. Verifica los campos con `ads_get_field_context` antes de pedirlos: nombre del ad, inversión, impresiones, clics, CTR y compras.
3. Para cada cuenta, `ads_get_ad_entities` con `level: "ad"`, `date_preset: "maximum"` (la app guarda la inversión total del ad) y un filtro por nombre del ad que acote a los nombres pedidos (por ejemplo, que contenga `AD_`). Pagina con `next_cursor` hasta el final.
4. Quédate con los ads cuyo nombre coincida **exactamente** con alguno de la lista. Si un nombre aparece en varios ads o cuentas, suma sus métricas y anota las cuentas.
5. Moneda: la app trabaja en soles. Si la cuenta está en `PEN`, usa la inversión tal cual. Si está en `USD`, multiplica por `SYNC_USD_PEN`; si no está definido y el usuario está presente, pregúntale el tipo de cambio; si no lo está, reporta el error del paso 3 en vez de enviar montos en otra moneda.

Solo lectura: este flujo nunca crea, edita ni pausa nada en Meta.

## 3. Devolver resultados

```bash
curl -s -X POST "$NOVA_URL/api/sync/agent/result" -H "Authorization: Bearer $SYNC_TOKEN" \
  -H "Content-Type: application/json" --data @resultado.json
```

`resultado.json` (escríbelo en el scratchpad, no en el repo):

```json
{
  "id": "<id de la solicitud>",
  "periodo": "maximum",
  "results": [
    { "nombre": "AD_NOVAFLEX_UGC_PROBSOL_DOLOR_008_A", "spend": 152.4, "compras": 6,
      "impresiones": 20311, "clics": 402, "ctr": 1.98, "cuentas": ["novashop_soles"] }
  ]
}
```

- `spend` en soles, con hasta 2 decimales. Los demás campos son opcionales: omite los que Meta no devuelva.
- Incluye solo los ads encontrados; el servidor calcula los faltantes.
- El servidor actualiza únicamente la inversión y un bloque informativo `meta`. Los pedidos confirmados siguen siendo manuales.

Si algo falla después de reclamar (MCP caído, moneda sin tipo de cambio…), avisa a la app para que no quede en "Sincronizando":

```json
{ "id": "<id>", "error": "Motivo breve y accionable" }
```

## 4. Resumen

Una o dos líneas: cuántos ads se actualizaron, cuáles no se encontraron en Meta y la inversión total sincronizada.

---

## Solicitud de fatiga (`tipo: "fatiga"`) o "sincroniza la fatiga"

La página **Fatiga** necesita métricas diarias por anuncio de **toda la cuenta**. Se usa en dos casos:

- Hay una solicitud `tipo: "fatiga"` pendiente: trae `cuenta`, `metrica`, `objetivo` y `etiqueta`. Reclámala como en el paso 1.
- El usuario te pide sincronizar la fatiga sin haber pulsado el botón: usa la cuenta que diga (o pregúntala) y envía directo; no hace falta reclamar nada.

El análisis lo hace la app (`src/studio/motor-fatiga.js`, el `MotorFatiga` del prototipo). Tú traes los datos y **nunca los transcribes a mano**: `scripts/fatiga-meta.mjs` los convierte y los envía.

1. **Cuenta:** con `ads_get_ad_accounts`, busca la que coincida (por ID, con o sin `act_`, o por nombre). Debe tener `is_ads_mcp_enabled` y `is_queryable` en `true`; si no, avísalo (y si había solicitud, envía `error` a `/api/sync/agent/result`). Anota su `currency`.
2. **Campos:** verifica con `ads_get_field_context`: `amount_spent`, `impressions`, `reach`, `link_click`, `omni_purchase` (o el evento que corresponda a `etiqueta`), `omni_purchase_values`, `video_play_actions`, `campaign_name`, `adset_name`, `created_time`, `frequency`.
3. **Anuncios con entrega:** `ads_get_ad_entities` con `level: "ad"`, `date_preset: "last_90d"`, campos `id, name, campaign_name, adset_name, created_time, frequency, impressions`, filtro `ad.impressions GREATER_THAN 0` y `limit: 1000`. Esta respuesta también sirve de metadatos.
4. **Datos diarios, por tandas:** Meta corta cada respuesta en 1.000 filas, así que pide de a **10 anuncios** por llamada: `level: "ad"`, `date_preset: "last_90d"`, `time_increment: "1"`, los campos métricos y filtro `ad.id IN [...]` con `limit: 1000`. Si una tanda devuelve exactamente 1.000 filas, pártela en dos. Si la cuenta tiene muchos anuncios, prioriza los que tuvieron entrega en los últimos 14 días y dilo en el resumen.
5. **Guarda cada respuesta en un archivo** del scratchpad. Las grandes ya quedan guardadas (la herramienta te da la ruta); las pequeñas escríbelas tal cual con Write como `{"ad_entities": "<el texto recibido>"}` o como arreglo JSON de filas.
6. **Convierte y envía:**

```bash
node scripts/fatiga-meta.mjs   --diario <tanda1> <tanda2> ...   --anuncios <respuesta del paso 3>   --cuenta "<nombre de la cuenta>" --moneda <currency>   [--objetivo <n>] [--metrica cpa|roas] [--etiqueta Compras]   --enviar
```

   El script lee `NOVA_URL` y `SYNC_TOKEN` del `.env`, envía a `/api/sync/agent/fatiga` y, si había una solicitud de fatiga abierta, la marca como lista. Imprime un resumen (`anuncios`, `filas`, `desde`, `hasta`, `sinMetadatos`): revísalo antes de contestar. Sin `--enviar` y con `--salida datos.json` solo arma el archivo.

- `gasto` queda en la moneda de la cuenta (`--moneda`); aquí no se convierte.
- Los anuncios de imagen que traen unas pocas reproducciones se marcan como imagen (el script lo resuelve).
- Si el envío responde 503, el servidor no tiene `SYNC_TOKEN`: dile al usuario que lo agregue en Coolify.

Resumen al usuario: cuántos anuncios y días enviaste, y que recargue el Studio: al abrirse importa los datos nuevos y los muestra en **Análisis 80/20** y **Fatiga**. Si quieres adelantar lo más urgente, guarda con `--salida` y evalúa ese archivo con `preparar` y `analizar` de `src/studio/motor-fatiga.js` (mismos números que verá en la página); no inventes cifras.
