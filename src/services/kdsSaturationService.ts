import { Server } from "socket.io";
import prisma from "../lib/prismaClient";
import { calcularBalanceFlujo, BalanceFlujoKDS } from "../lib/kdsFlowModel";
const VENTANA_MIN = Number(process.env.KDS_VENTANA_MIN) || 10;
const UMBRAL_CRITICO = Number(process.env.KDS_UMBRAL_CRITICO) || 0.5;

export const MENSAJE_SATURACION =
  "Cafetería con alta demanda, los pedidos pueden demorar más de lo habitual";
let ultimoEstadoSaturado = false;
let ultimaMetrica: BalanceFlujoKDS | null = null;

async function calcularLambda(desde: Date): Promise<number> {
  const entradas = await prisma.order.count({
    where: {
      status: { not: "CARRITO" },
      fecha: { gte: desde },
    },
  });
  return entradas / VENTANA_MIN;
}

async function calcularMu(desde: Date): Promise<number> {
  const salieron = await prisma.order.count({
    where: {
      OR: [{ fechaListo: { gte: desde } }, { fechaEntregado: { gte: desde } }],
    },
  });
  return salieron / VENTANA_MIN;
}

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

export function getUltimaMetricaKDS(): BalanceFlujoKDS | null {
  return ultimaMetrica;
}
