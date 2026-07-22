// --- Modelo matemático: Alerta de Saturación del KDS ---
// Ecuación de balance de flujo (teoría de colas / flujos):
//
//     dO/dt = lambda(t) - mu
//
// dO/dt      : ritmo de acumulación de órdenes en el KDS (órdenes/min)
// lambda(t)  : tasa de órdenes ENTRANTES por minuto (checkout -> PAGADO)
// mu         : tasa de órdenes DESPACHADAS por minuto (A_C marca LISTO/ENTREGADO)
//
// Si dO/dt > 0 y supera un umbral crítico parametrizado, el sistema está
// acumulando órdenes más rápido de lo que la cocina puede procesarlas:
// riesgo de colapso operativo.

export interface BalanceFlujoKDS {
  lambda: number; // ordenes/min entrantes
  mu: number; // ordenes/min despachadas
  diferencial: number; // dO/dt = lambda - mu
  umbralCritico: number;
  saturado: boolean;
}

/**
 * Calcula el balance de flujo dO/dt = lambda - mu y determina si el
 * diferencial supera el umbral crítico de tolerancia (riesgo de colapso).
 *
 * Función pura, sin acceso a BD ni IO: facilita pruebas unitarias del
 * modelo matemático de forma aislada.
 */
export function calcularBalanceFlujo(
  lambda: number,
  mu: number,
  umbralCritico: number,
): BalanceFlujoKDS {
  const diferencial = lambda - mu;
  const saturado = diferencial > 0 && diferencial >= umbralCritico;

  return {
    lambda,
    mu,
    diferencial,
    umbralCritico,
    saturado,
  };
}
