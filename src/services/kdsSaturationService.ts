import { Server } from "socket.io";
import prisma from "../lib/prismaClient";
import { calcularBalanceFlujo, BalanceFlujoKDS } from "../lib/kdsFlowModel";

// --- Parametrización (ajustable vía variables de entorno sin tocar código) ---
// KDS_VENTANA_MIN: tamaño de la ventana deslizante (minutos) usada para
//                  estimar lambda y mu de forma dinámica en tiempo real.
// KDS_UMBRAL_CRITICO: diferencial (ordenes/min) a partir del cual se
//                      considera riesgo de saturación crítica.
const VENTANA_MIN = Number(process.env.KDS_VENTANA_MIN) || 10;
const UMBRAL_CRITICO = Number(process.env.KDS_UMBRAL_CRITICO) || 0.5;

export const MENSAJE_SATURACION =
  "Cafetería con alta demanda, los pedidos pueden demorar más de lo habitual";

// Estado en memoria del proceso: evita re-emitir el mismo aviso en cada
// tick del cron; solo se notifica al frontend cuando el estado CAMBIA
// (entra o sale de saturación), regulando el flujo de forma orgánica sin
// saturar tampoco los sockets de los alumnos conectados.
let ultimoEstadoSaturado = false;
let ultimaMetrica: BalanceFlujoKDS | null = null;

/**
 * lambda(t): tasa de pedidos entrantes por minuto.
 *
 * Nota de mapeo con el esquema real: TuCampus no usa un status literal
 * "RECIBIDO"; el evento equivalente (la orden entra formalmente a la cola
 * de cocina) es la transición CARRITO -> PAGADO, que ocurre en
 * `checkout` / `becaCheckout` y queda registrada en `Order.fecha`.
 */
async function calcularLambda(desde: Date): Promise<number> {
  const entradas = await prisma.order.count({
    where: {
      status: { not: "CARRITO" },
      fecha: { gte: desde },
    },
  });
  return entradas / VENTANA_MIN;
}

/**
 * mu: tasa de despacho/capacidad de la cocina por minuto, medida por las
 * acciones del Administrador de Cocina (A_C): marcar LISTO (`markAsReady`,
 * timestamp `fechaListo`) o confirmar ENTREGADO vía QR (`verifyOrder`,
 * timestamp `fechaEntregado`).
 *
 * Nota: se cuenta con OR (órdenes distintas), no se suman dos counts
 * separados. Si se sumaran, una misma orden que pasa por LISTO y luego
 * ENTREGADO dentro de la misma ventana se contaría dos veces, inflando
 * artificialmente mu y pudiendo ocultar una saturación real.
 */
async function calcularMu(desde: Date): Promise<number> {
  const salieron = await prisma.order.count({
    where: {
      OR: [{ fechaListo: { gte: desde } }, { fechaEntregado: { gte: desde } }],
    },
  });
  return salieron / VENTANA_MIN;
}

/**
 * Evalúa dO/dt = lambda - mu con datos transaccionales reales y, si
 * corresponde, inyecta (o retira) el aviso restrictivo en el frontend del
 * alumno vía Socket.io. Diseñada para ejecutarse tanto en un cron periódico
 * como inmediatamente después de eventos clave de la orden (checkout,
 * marcar listo, verificar entrega) para reaccionar casi en tiempo real.
 */
export async function evaluarSaturacionKDS(
  io?: Server,
): Promise<BalanceFlujoKDS> {
  const desde = new Date(Date.now() - VENTANA_MIN * 60 * 1000);

  const [lambda, mu] = await Promise.all([
    calcularLambda(desde),
    calcularMu(desde),
  ]);

  const metrica = calcularBalanceFlujo(lambda, mu, UMBRAL_CRITICO);
  ultimaMetrica = metrica;

  // Solo se emite si el estado de saturación CAMBIÓ respecto al último
  // cálculo, tal como pide el modelo (aviso preventivo, no ruido constante).
  if (io && metrica.saturado !== ultimoEstadoSaturado) {
    io.emit("kds_saturacion_update", {
      activo: metrica.saturado,
      mensaje: metrica.saturado ? MENSAJE_SATURACION : null,
      lambda: Number(metrica.lambda.toFixed(2)),
      mu: Number(metrica.mu.toFixed(2)),
      diferencial: Number(metrica.diferencial.toFixed(2)),
      umbralCritico: UMBRAL_CRITICO,
      ventanaMin: VENTANA_MIN,
      timestamp: new Date(),
    });
  }

  ultimoEstadoSaturado = metrica.saturado;
  return metrica;
}

/** Última métrica calculada, sin volver a consultar la BD (para endpoints de solo lectura tipo dashboard). */
export function getUltimaMetricaKDS(): BalanceFlujoKDS | null {
  return ultimaMetrica;
}
