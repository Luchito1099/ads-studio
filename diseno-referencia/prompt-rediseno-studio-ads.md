# Prompt · Rediseño de NOVITOOLS STUDIO ADS

> Pega este texto en tu agente de código (Claude Code u otro) abierto sobre el repositorio de tu Studio de Ads actual (rotulados.conluismz.com). Copia también la carpeta `diseno-referencia/` (viene en el .zip) en la raíz del repo.

---

## Contexto

Tengo una plataforma propia llamada **NOVA · Studio de Ads** (rotulados.conluismz.com). Hoy tiene las pestañas Pipeline, Banco, Ganadores y Métricas, y una **Biblioteca de ads** con referentes que guardo desde mi extensión de Chrome **Nova Swipe**.

Quiero rediseñarla y ampliarla siguiendo el diseño de la carpeta `diseno-referencia/`. Ahí hay un archivo `.dc.html` por pantalla: cada uno tiene el HTML, los estilos y un bloque `<script>` con la lógica y los datos de ejemplo. **Úsalos como referencia visual y de comportamiento, no como código para copiar tal cual**: hay que llevarlos al stack que ya usa el proyecto.

El producto pasa a llamarse **NOVITOOLS STUDIO ADS**.

---

## Regla número 1 · La Biblioteca de ads no se toca

Todo lo que ya está guardado en la Biblioteca de ads (referentes, archivos, videos, imágenes, copys, marcas, notas, fechas, etiquetas) **tiene que seguir exactamente igual después del rediseño**.

- **No borres, renombres ni cambies el tipo** de ninguna tabla, colección, columna o campo que use hoy la Biblioteca.
- **No muevas ni renombres** archivos o carpetas de medios (videos, imágenes, capturas) ni cambies sus rutas o URLs.
- **Las migraciones solo pueden agregar.** Si la Biblioteca necesita datos nuevos (etapa, formato, ángulo, canal, marca, producto, estado de asignación), van en **columnas nuevas que acepten vacío** o en **tablas nuevas que apunten al referente por su ID**. Los registros existentes quedan con esos campos vacíos y se ven en la bandeja "Sin asignar".
- **Nada de scripts que reescriban registros existentes** en masa (ni "normalizar", ni "limpiar", ni "re-etiquetar con IA"). Si propones algo así, me lo preguntas antes y queda como una acción manual opcional dentro de la plataforma.
- **El endpoint donde Nova Swipe guarda referentes tiene que seguir funcionando igual** (misma URL, mismo formato de entrada). Si agregas campos opcionales nuevos (por ejemplo marca), que sean opcionales.

**Antes de cambiar cualquier cosa:**
1. Haz un **respaldo completo** de la base de datos y de la carpeta de medios, y dime dónde quedó.
2. Anota **cuántos referentes hay** en la Biblioteca (total, y por tipo si se puede).

**Al terminar cada fase:**
3. Vuelve a contar y confirma que el número es **el mismo o mayor**, nunca menor.
4. Abre 5 referentes al azar y confirma que se ven igual que antes, con su archivo y su copy.

Si en algún momento un cambio pone en riesgo esos datos, **detente y pregúntame**.

---

## Antes de programar

1. Revisa el repo y dime: **stack** (framework, base de datos, cómo se sirven los medios), **dónde vive la Biblioteca** (modelos o tablas, rutas, endpoint de Nova Swipe) y **qué pantallas existen hoy**.
2. Proponme un **plan por fases** (abajo va el orden sugerido) con los cambios de base de datos de cada fase, marcando cuáles son **solo agregados**.
3. **Espera mi OK** antes de empezar la fase 1.

---

## Estilo visual (igual en todas las pantallas)

- Fondo gris claro `#eef2f6`, tarjetas blancas con borde `#e2e8f0` y radio de 14 a 16 px.
- Texto slate (`#0f172a`, `#475569`, `#94a3b8`) y color de acento **teal `#0d9488`**.
- Tipografía **Inter**; números e IDs en **JetBrains Mono**.
- Íconos SVG de trazo, **sin emojis**.
- **Los popups se abren centrados**, nunca como panel lateral ni como página aparte. Guardar o avanzar de etapa **cierra el popup**.
- UX simple: pocas opciones visibles y lo demás al pasar el mouse o dentro del popup.
- Etapas con color fijo: **TOFU verde, MOFU amarillo, BOFU rojo**.

---

## Estructura

### Menú lateral (`Sidebar`)
- Logo "noviitools / STUDIO ADS".
- **Selector de marca** (NOVAFLEX, KLYNEA, Nova Shop, y "Nueva marca"), con el color de cada una.
- **Filtro de producto como desplegable compacto** (una línea; el buscador interno solo si hay más de 5 productos). La marca y el producto elegidos filtran todas las pantallas.
- Secciones:
  - **Creativos:** Embudo · Content Pipeline · Hooks · Biblioteca
  - **Resultados:** Testing · Ganadores · Métricas
  - **Operación:** Plan de implementación · Tareas

### Conceptos clave
- **Formato** = cómo se hace la pieza (UGC, POV, Voz en off, Transformacional, Demo, Unboxing, Testimonio, Comparativo…). No llamarlos "conceptos".
- **Ángulo** = qué idea de venta usa (Trabajo de pie, Pagas al recibir…). Es **opcional** y **nunca viene preseleccionado**.
- **Etapa:** TOFU / MOFU / BOFU.
- **Canal destino del anuncio:** Web o WhatsApp.
- **Tipo de pieza:** video, estático o carrusel. Los estáticos y carruseles no llevan guion y saltan la etapa Edición.
- **IDs:** `SCR_###` (video), `EST_###` (estático), `CAR_###` (carrusel), `ORG_###` (orgánico), `IDEA-###`.

---

## Pantallas (ver el archivo de referencia de cada una)

**1. Embudo** (`Main.dc.html`)
Lienzo con TOFU/MOFU/BOFU y los formatos de cada etapa. Tiene modo Anuncios/Orgánico, cuotas semanales por etapa, "Estrategia de venta" por marca, y las vistas Formatos / Colmena / Grilla. Al abrir un formato salen sus referentes, sus piezas creadas y sus hooks. Desde un referente se puede ver el storyboard, copiar el copy del anuncio, copiar la imagen (estático) o el carrusel en una captura, y "Usar como referencia", que crea una pieza en la columna Idea del Content Pipeline.

**2. Content Pipeline** (`Pipeline.dc.html`)
Carriles Ads y Orgánico, con columnas Idea → Guion/Brief → Producción → Edición → Revisión → Listo para lanzar. Cada pieza se edita en un popup centrado:
- Para video, el editor es **HOOK / BODY / CTA**, con varias versiones de hook y el botón "Copiar guion de corrido" (un solo párrafo para ElevenLabs).
- Para estáticos y carruseles, el editor es de textos (texto principal, apoyo, oferta, CTA, copy del anuncio, estilo visual, tarjetas) y genera un brief.
- Hay que elegir **"Lleva a: Web / WhatsApp"**.
- Botón **Nomenclatura**: configura cómo se llama cada anuncio (marca, producto, ID, versión, canal, formato, ángulo, etapa, fecha; separador `_`, `-` o `|`). ID, versión y canal son obligatorios. Ejemplo: `NFX_TOB_SCR046_H1_WEB_UGC_PIE_TOFU`.
- Al llegar a "Listo para lanzar" se muestran los nombres de cada anuncio para copiarlos a Meta, más el parámetro `utm_content={{ad.name}}`.

**3. Hooks** (`Hooks.dc.html`)
Banco de hooks en vista de tarjetas o de lista, con filtro por ángulo y estrella para los ganadores. El ángulo es opcional y se puede editar. "Usar" un hook crea una pieza nueva o lo agrega a una pieza existente.

**4. Biblioteca** (`Referentes.dc.html`) — **ver la Regla número 1**
- **Muestra los referentes que ya existen.** Los que no tienen marca, etapa ni formato aparecen en la bandeja "Sin asignar".
- **Filtros:** estado, marca, tipo y **canal** (Meta Ads, TikTok, Instagram, Facebook, YouTube, Pinterest), más un buscador.
- **Todas las tarjetas tienen el mismo tamaño.**
- **Popup "Asignar":** marca y producto → etapa → formato → ángulo (opcional), con una sugerencia que se acepta con un clic y la opción "Asignar y siguiente".
- **Asignar solo escribe en los campos o tablas nuevas.** Nunca modifica el referente original.

**5. Testing** (`Testing.dc.html`)
- **Sincronización por Excel/CSV del Administrador de anuncios.** No hay API de Meta por ahora.
  - Cada fila se identifica por **anuncio + día**. Si se vuelve a subir un día, se reemplaza.
  - Se lee .xlsx y .csv, con columnas en español o inglés.
  - El export tiene que traer el desglose por día, o "Inicio = Fin del informe". Si trae totales de un rango, se rechaza con instrucciones.
- **Se cruza por el nombre del anuncio:** se busca el ID y la versión, por ejemplo SCR046 + H1.
  - Si un anuncio no tiene ID, cae en "Sin vincular". Ahí se registra como pieza nueva (con etapa, tipo, canal, formato, ángulo, producto y referente de la Biblioteca) o se une a una pieza existente.
  - Ese vínculo se guarda por nombre del anuncio, así las cargas siguientes se unen solas.
- **Embudo por canal, con el paso más débil marcado en rojo:**
  - **Web:** Hook → Hold → CTR → Carga → Pedido → Cierre, decidido por **costo por compra**.
  - **WhatsApp:** Hook → Hold → CTR → Conversación → Nuevos, decidido por **costo por conversación**.
  - **Frecuencia:** se toma la del último día.
- **Regla editable:** meta de costo por canal, gasto mínimo, día de inicio, frecuencia máxima y umbrales de cada paso. La plataforma **sugiere** Ganador, Apagar o Seguir probando, pero **la decisión es mía**: botones Ganador / Apagar / Deshacer.
- **El CPA real por pedido entregado NO se calcula aquí.**

**6. Ganadores** y **7. Métricas** (`Ganadores.dc.html`, `Metricas.dc.html`)
- **Ganadores** recibe lo que marco en Testing.
- **Métricas** guarda el histórico. Se guardan **conteos**, no porcentajes: gasto, impresiones, alcance, reproducciones de 3 s, ThruPlays, clics, visitas, pagos iniciados, compras, conversaciones y contactos nuevos. Los porcentajes se calculan al mostrar.
- Incluye la matriz **Formato × Ángulo** (tests, ganadores, costo).

**8. Plan de implementación** (`Implementacion.dc.html`)
- **Calendario semanal:** filas TOFU, MOFU, BOFU y Orgánico; columnas de lunes a domingo. Las piezas se arrastran para cambiarles el día, y abajo hay una bandeja "Sin fecha".
- **Arriba, un aviso con el veredicto:** "con lo programado llegas a X de Y" y qué falta.
- **Cada pieza estima cuándo estará lista según su etapa en el Pipeline.** Si se programa antes de esa fecha, se marca "No llega".
- **Datos:** las piezas salen del Pipeline, lo publicado sale de Testing y las cuotas salen del Embudo. Aquí solo se decide el día.

**9. Tareas** (`Tareas.dc.html`)
- **La plataforma es solo para mí:** no hay asignación por persona.
- **Las tareas se agrupan por prioridad** (Alta / Media / Baja) y llevan su **tiempo** (10, 30 o 90 min). Hay un filtro "Tengo 10 / 30 / 90 min".
- **Casi todas son automáticas:** nacen de reglas (decidir en Testing, subir a Meta, grabar o editar, pieza estancada, cuota baja, variaciones de un ganador, vincular anuncios, bandeja de la Biblioteca, sincronizar el Excel) y **se cierran solas** cuando se cumple su condición.
- **Las reglas se pueden apagar.** Las tareas manuales son las únicas con casilla para marcar a mano.

---

## Versión mobile

La plataforma tiene que funcionar también en el celular. En `diseno-referencia/` están las pantallas mobile de uso diario: `M-Tareas`, `M-Testing`, `M-Pipeline` y `M-Hooks`, más el componente `MobileNav` (menú inferior). Están pensadas para 390 px de ancho.

- **Por debajo de 768 px** el menú lateral se oculta y aparece el **menú inferior fijo** con Tareas · Pipeline · Testing · Hooks · Más. "Más" abre un popup con el selector de marca y producto y el resto de pantallas.
- **Tareas:** tarjetas grandes por prioridad, con el filtro "Tengo 10 / 30 / 90 min" en chips que se deslizan. Botones "Mañana" e "Ir →" o "Hecha".
- **Testing:** cada anuncio es una tarjeta (no una tabla), con el costo grande, el embudo en chips deslizables, la sugerencia y botones grandes de Apagar y Ganador. "Excel" abre la subida de archivo desde Archivos o Drive.
- **Content Pipeline:** las etapas son chips arriba y debajo va la lista de piezas de la etapa elegida. Al tocar una pieza se abre un popup con HOOK / BODY / CTA editable, pestañas de versión H1, H2… y el botón grande **"Copiar guion de corrido"** para ElevenLabs. En "Listo" muestra los nombres para Meta con su botón Copiar.
- **Hooks:** buscador, chips de ángulo, tarjetas con Copiar, Usar y estrella. El botón + abre el popup de hook nuevo.
- **Embudo, Biblioteca, Métricas y Plan** quedan como web responsive simple (que no se rompan), con la nota "mejor en computadora".
- **Reglas de mobile:**
  - Zonas táctiles de al menos 40–44 px.
  - Inputs con fuente de 16 px, para que iOS no haga zoom.
  - Sin hover para mostrar acciones: en mobile todo va visible.
  - Respetar `env(safe-area-inset-*)`.
  - Usar `100dvh` y no `100vh`.
  - Los popups siguen centrados.
  - Probarlo en un celular real.

---

## Fases sugeridas

1. **Base sin riesgo:** respaldo, conteo de la Biblioteca, nuevo estilo visual y menú lateral con marca y producto. La Biblioteca sigue funcionando y se ve igual.
2. **Biblioteca nueva sobre los datos existentes:** pantalla nueva, filtros, bandeja "Sin asignar" y popup Asignar. **Solo tablas o campos nuevos.**
3. **Embudo + Content Pipeline + Hooks** (con nomenclatura y canal).
4. **Testing con sincronización de Excel** + Ganadores + histórico en Métricas.
5. **Plan de implementación + Tareas automáticas.**
6. **Versión mobile** de Tareas, Testing, Content Pipeline y Hooks, con el menú inferior.

En cada fase: **respaldo antes, conteo de la Biblioteca después**, y un resumen corto de qué cambió en la base de datos.

---

## Criterios de aceptación

- [ ] La Biblioteca tiene **la misma cantidad de referentes o más** que antes, y los existentes se ven con su archivo, su copy y sus datos originales.
- [ ] Nova Swipe sigue guardando en la Biblioteca sin cambios en la extensión.
- [ ] Ninguna migración borra, renombra o cambia el tipo de algo que ya existía.
- [ ] Todos los popups se abren centrados, y guardar o avanzar los cierra.
- [ ] El filtro de marca y producto aplica en todas las pantallas.
- [ ] Testing lee un export real de Meta (.xlsx) y reconoce los anuncios por la nomenclatura.
- [ ] Hay un respaldo descargable de antes del rediseño.
- [ ] En un celular real, Tareas, Testing, Content Pipeline y Hooks se usan cómodos con el menú inferior, y "Copiar guion de corrido" funciona.
