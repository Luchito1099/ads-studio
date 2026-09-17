---
name: sync-meta
description: Atiende el botón "Sincronizar Meta" de NOVA Studio. Toma la solicitud pendiente del servidor, consulta en Meta Ads (MCP) la inversión de cada ad por su nombre y devuelve los resultados para que la app se actualice. Úsalo cuando el usuario diga "sincroniza", "/sync-meta" o cuando una rutina lo invoque.
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
