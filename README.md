# NOVA · Studio de Ads

Componente React de una sola pieza para gestionar la producción de anuncios: banco de referencias, pipeline de guiones, seguimiento de ganadores y métricas de acierto.

Pensado para equipos que iteran creativos en Meta / TikTok y necesitan una nomenclatura consistente y datos sobre qué ángulos, formatos y conceptos realmente funcionan.

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

La taxonomía viene con vocabularios controlados para **formatos** (UGC, TESTI, DEMO, VSL, ANTDES…), **conceptos** (PROBSOL, TRANSF, HISTORIA, EDUCA…) y **ángulos**, de modo que las métricas se puedan agrupar sin ruido.

## Persistencia

Todo vive en `localStorage` del navegador — no hay backend ni cuentas:

- `nova-ads:all:v1` — ads y guiones
- `nova-refs:list:v1` — referencias del banco
- `nova-refimg:{id}` — miniaturas (redimensionadas a 640px y comprimidas a JPEG antes de guardar)

Los datos son locales al navegador y al perfil. Exporta antes de limpiar el almacenamiento del sitio.

## Uso

El archivo exporta un componente `App` por defecto. Requiere React 18+, Tailwind CSS y `lucide-react`:

```bash
npm install react react-dom lucide-react
```

```jsx
import App from "./nova-ads-studio.jsx";

export default function Page() {
  return <App />;
}
```

Los estilos usan clases de Tailwind, así que necesitas Tailwind configurado en el proyecto que lo consuma.

## Estructura

Un solo archivo, [nova-ads-studio.jsx](nova-ads-studio.jsx), organizado en:

- Helpers y taxonomía (constantes de estados, productos, formatos, conceptos, ángulos)
- Componentes de presentación — `Chip`, `Stars`, `Card`, `RefCard`, `ScriptTable`
- Editores modales — `Editor` (ads), `RefEditor` (referencias)
- `App` — estado global, filtros, estadísticas y layout
