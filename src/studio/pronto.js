import { $, S, UI, esc, ic } from "./nucleo.js";
import { render, setTop } from "./vista.js";

/**
 * Las pantallas del diseño que todavía no están hechas.
 *
 * Aparecen en el menú con su nombre definitivo para que la navegación sea la
 * del diseño desde el primer día, pero dicen con todas sus letras qué va a
 * haber ahí y en qué fase llega. Y, mientras tanto, llevan a la pantalla vieja
 * que hoy hace ese trabajo: nada de callejones sin salida.
 */

const PANTALLAS = {
  testing: {
    titulo: 'Testing', grupo: 'Resultados', fase: 4, icono: 'flask',
    que: 'Subes el Excel del Administrador de anuncios y cada fila se une a su pieza por el nombre del anuncio. Verás el embudo de cada variación con el paso donde se cae en rojo —Hook, Hold, CTR, Carga, Pedido, Cierre en Web; Conversación y Nuevos en WhatsApp—, el costo por compra o por conversación, y una sugerencia de Ganador, Apagar o Seguir probando que tú confirmas.',
    ahora: [['analisis', 'Análisis 80/20'], ['fatiga', 'Fatiga']],
  },
  ganadores: {
    titulo: 'Ganadores', grupo: 'Resultados', fase: 4, icono: 'trophy',
    que: 'Lo que marques como ganador en Testing llega aquí con sus números, por qué ganó y el botón para sacarle variaciones con otros ángulos.',
    ahora: [['tracker', 'Tracker']],
  },
  metricas: {
    titulo: 'Métricas', grupo: 'Resultados', fase: 4, icono: 'chart',
    que: 'El histórico: gasto, impresiones, alcance, reproducciones de 3 s, ThruPlays, clics, visitas, pagos iniciados, compras y conversaciones. Se guardan los conteos, no los porcentajes, y arriba va la matriz Formato × Ángulo para ver qué combinación gana.',
    ahora: [['analisis', 'Análisis 80/20'], ['tracker', 'Tracker']],
  },
  plan: {
    titulo: 'Plan de implementación', grupo: 'Operación', fase: 5, icono: 'cal',
    que: 'El calendario de la semana con filas TOFU, MOFU, BOFU y Orgánico. Arrastras cada pieza al día en que sale y arriba te dice si con lo programado llegas a la cuota, avisando cuáles no van a estar listas a tiempo.',
    ahora: [['pipeline', 'Content Pipeline']],
  },
  tareas: {
    titulo: 'Tareas', grupo: 'Operación', fase: 5, icono: 'check',
    que: 'Las tareas nacen solas de lo que pasa en el Studio —decidir en Testing, subir a Meta, grabar, una pieza estancada, la cuota baja, la bandeja de la Biblioteca— y se cierran solas cuando haces lo que piden. Se agrupan por prioridad y traen el filtro "Tengo 10 / 30 / 90 min".',
    ahora: [['pipeline', 'Content Pipeline'], ['referencias', 'Biblioteca']],
  },
};

export function vPronto() {
  const p = PANTALLAS[UI.view];
  if (!p) return;
  setTop(p.titulo, `${esc(S.marca || 'NOVA')} · ${p.grupo}`);
  $('#body').innerHTML = `<div class="pronto">
    <div class="pico">${ic(p.icono)}</div>
    <h2>${esc(p.titulo)} llega en la fase ${p.fase}</h2>
    <p>${esc(p.que)}</p>
    ${p.ahora.length ? `<div class="pahora">
      <span class="hint">Mientras tanto, esto es lo que hay hoy:</span>
      <div>${p.ahora.map(([v, l]) => `<button class="btn ghost" data-ir="${v}">${esc(l)} →</button>`).join('')}</div>
    </div>` : ''}
  </div>`;
  document.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { UI.view = b.dataset.ir; render(); });
}

export const esPronto = (v) => !!PANTALLAS[v];
