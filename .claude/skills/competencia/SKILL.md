---
name: competencia
description: Revisa la competencia de NOVA Studio. Consulta la Biblioteca de anuncios de Meta (MCP de Meta Ads) para cada marca configurada en Medir → Competencia y envía sus anuncios activos al Studio. Úsalo cuando el usuario diga "revisa la competencia", "qué está corriendo la competencia", "/competencia" o cuando una rutina lo invoque.
---

# Revisar la competencia

El Studio guarda **a quién vigilar**; tú traes **qué tienen activo hoy**. La app no tiene credenciales de Meta: el contrato del servidor está en `server/competencia.js`.

## 0. Configuración

Lee de las variables de entorno o, si no están, del `.env` en la raíz del repo:

- `NOVA_URL`: URL pública de la app, sin `/` final.
- `SYNC_TOKEN`: el mismo valor configurado en el servidor.

Si falta alguna, detente y dile al usuario qué falta. Nunca muestres el token.

## 1. A quién vigilar

```bash
node scripts/competencia.mjs --lista
```

Devuelve, por competidor: `id`, nombre, país, IDs de página, palabras clave y cuándo se revisó por última vez. Si la lista está vacía, dile al usuario que agregue marcas en **Medir → Competencia** y termina.

## 2. Buscar sus anuncios activos

Para **cada** competidor, usa `ads_library_search` del MCP de Meta Ads:

- Con ID de página: `page_ids: ["<id>"]`, `countries: ["<país>"]`, `ad_active_status: "ACTIVE"`, `limit: 50`.
- Sin ID de página: `search_terms: "<palabras clave>"`, mismo país y estado.

Guarda cada respuesta tal cual en un archivo (no transcribas nada a mano):

```bash
cat > /tmp/comp1.json <<'JSON'
<la respuesta del MCP, completa>
JSON
```

Notas:

- `limit` máximo 50. Si `estimated_total_count` es mayor, haz varias búsquedas con términos distintos (producto, marca, oferta) y pasa todos los archivos juntos: el script quita duplicados por ID.
- Una búsqueda por palabra clave trae anuncios de varias marcas. Usa `--paginas` para quedarte solo con las páginas del competidor; si no sabes el ID de la página, míralo en `page_id` de los resultados y dile al usuario que lo guarde en la ficha.
- Esto es investigación puntual de la competencia, no una descarga masiva de la Biblioteca.

## 3. Enviar la foto al Studio

```bash
node scripts/competencia.mjs --competidor "<id>" --nombre "<marca>" \
  --archivos /tmp/comp1.json /tmp/comp2.json \
  --paginas "<page_id>,<page_id>" --pais PE --enviar
```

El servidor guarda los anuncios, calcula cuáles son nuevos y deja el histórico por día. Repite el comando por cada competidor.

## 4. Contarle al usuario

Un resumen corto, sin listas kilométricas. Por cada marca: cuántos anuncios activos tiene, cuántos son nuevos desde la última revisión y cuál es el más antiguo que sigue corriendo (ese suele ser su ganador). Cierra recordándole que en **Medir → Competencia** puede abrir cualquiera y guardarlo con Nova Swipe para extraerle el guion.

No inventes datos: si Meta no devuelve nada para una marca, dilo y sugiere revisar el ID de la página o las palabras clave.
