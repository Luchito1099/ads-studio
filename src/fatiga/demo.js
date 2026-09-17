import { sumarDias } from "./motor.js";

/**
 * Datos de demostración: 10 anuncios con comportamientos distintos
 * (sano, desgaste lento, fatigado, audiencia saturada, recién lanzado…).
 * Deterministas, para que la demo se vea igual cada vez.
 */
export function generarDemo(hoy = new Date().toISOString().slice(0, 10), dias = 90) {
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  const ruido = (k = 0.08) => 1 + (azar() - 0.5) * 2 * k;
  const inicio = sumarDias(hoy, -(dias - 1));

  const perfiles = [
    { nombre: "AD_NOVAFLEX_UGC_PROBSOL_DOLOR_001_A", campana: "PROS | Ventas", edad: 90, gasto: 60, ctr: 0.018, caida: 0.0, cpa: 22, video: true },
    { nombre: "AD_NOVAFLEX_TESTI_TRANSF_ACTIVO_003_A", campana: "PROS | Ventas", edad: 80, gasto: 45, ctr: 0.022, caida: 0.006, cpa: 26, video: true },
    { nombre: "AD_NOVAFLEX_UGC_EDUCA_PADRES_004_A", campana: "PROS | Ventas", edad: 70, gasto: 50, ctr: 0.02, caida: 0.012, cpa: 38, video: true },
    { nombre: "AD_NOVAFLEX_DEMO_COMPARA_DOLOR_011_A", campana: "PROS | Ventas", edad: 60, gasto: 35, ctr: 0.016, caida: 0.004, cpa: 30, video: false },
    { nombre: "AD_NOVAFIT_ESTATICA_OFERTA_PRECIO_006_A", campana: "PROS | Oferta", edad: 55, gasto: 30, ctr: 0.013, caida: 0.0, cpa: 45, video: false },
    { nombre: "AD_NOVAFLEX_UGC_OBJECION_DOLOR_002_A", campana: "RMK | Carrito", edad: 75, gasto: 20, ctr: 0.028, caida: 0.0, cpa: 18, video: true, saturacion: true },
    { nombre: "AD_NOVAFIT_VSL_HISTORIA_ACTIVO_007_A", campana: "PROS | Ventas", edad: 40, gasto: 25, ctr: 0.017, caida: 0.009, cpa: 24, video: true },
    { nombre: "AD_NOVAFLEX_GREEN_SORPRESA_DOLOR_009_A", campana: "PROS | Ventas", edad: 30, gasto: 40, ctr: 0.021, caida: 0.002, cpa: 20, video: true, escala: true },
    { nombre: "AD_NOVAFIT_CARRU_LISTA_COMODIDAD_010_A", campana: "PROS | Oferta", edad: 20, gasto: 15, ctr: 0.011, caida: 0.0, cpa: 60, video: false },
    { nombre: "AD_NOVAFLEX_UGC_PROBSOL_DOLOR_012_A", campana: "PROS | Ventas", edad: 5, gasto: 30, ctr: 0.019, caida: 0.0, cpa: 25, video: true },
  ];

  const anuncios = [];
  const diario = [];
  perfiles.forEach((p, i) => {
    const id = `demo_${String(i + 1).padStart(2, "0")}`;
    const arranque = sumarDias(hoy, -(p.edad - 1));
    anuncios.push({ id, nombre: p.nombre, campana: p.campana, conjunto: p.campana.startsWith("RMK") ? "Visitantes 30d" : "Broad PE", fecha_inicio: arranque, frecuencia_acumulada: p.saturacion ? 7.4 : Math.round((1.3 + i * 0.12) * 10) / 10 });
    for (let d = 0; d < dias; d++) {
      const fecha = sumarDias(inicio, d);
      if (fecha < arranque) continue;
      const vida = Math.round((Date.parse(fecha) - Date.parse(arranque)) / 86400000);
      const tramoFinal = p.escala && vida > p.edad - 15 ? 1.8 : 1;
      const gasto = p.gasto * tramoFinal * ruido(0.15);
      const cpm = 9 * ruido(0.1) * (p.saturacion ? 1 + vida * 0.004 : 1);
      const impresiones = Math.round((gasto / cpm) * 1000);
      const frecDia = p.saturacion ? 1.05 + vida * 0.012 : 1.08 + vida * 0.0015;
      const alcance = Math.round(impresiones / frecDia);
      // Arranque: los primeros días rinde un poco menos; luego decae según `caida`.
      const calentamiento = vida < 3 ? 0.85 : 1;
      const ctr = Math.max(0.003, p.ctr * calentamiento * (1 - p.caida * Math.max(0, vida - 10)) * ruido(0.1));
      const clics = Math.round(impresiones * ctr);
      const cpa = p.cpa * (1 + p.caida * Math.max(0, vida - 10) * 1.2) * ruido(0.3);
      const resultados = Math.max(0, Math.round(gasto / cpa + (azar() - 0.5)));
      diario.push({
        fecha, ad_id: id,
        gasto: Math.round(gasto * 100) / 100,
        impresiones, alcance, clics, resultados,
        valor: Math.round(resultados * 119 * 100) / 100,
        vistas_3s: p.video ? Math.round(impresiones * 0.32 * (1 - p.caida * Math.max(0, vida - 10) * 0.8) * ruido(0.05)) : 0,
      });
    }
  });

  return {
    meta: { cuenta: "Demo NOVA", moneda: "PEN", metrica_rectora: "cpa", objetivo: 30, etiqueta_resultado: "Compras", fuente: "demo", actualizado: new Date().toISOString() },
    anuncios,
    diario,
  };
}
