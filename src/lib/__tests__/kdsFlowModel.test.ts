// Pruebas unitarias del modelo matemático de balance de flujo del KDS.
//
// Usa el runner de pruebas nativo de Node (node:test / node:assert), sin
// dependencias externas, porque calcularBalanceFlujo es una función pura
// (sin acceso a BD ni IO) diseñada justo para poder probarse aislada.
//
// Ejecutar con: npm run test:kds

import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularBalanceFlujo } from "../kdsFlowModel";

test("dO/dt: caso balanceado (lambda == mu) => diferencial 0, no saturado", () => {
  const r = calcularBalanceFlujo(5, 5, 0.5);
  assert.equal(r.diferencial, 0);
  assert.equal(r.saturado, false);
});

test("dO/dt: cocina despacha más rápido de lo que entra (lambda < mu) => no saturado", () => {
  const r = calcularBalanceFlujo(3, 6, 0.5);
  assert.equal(r.diferencial, -3);
  assert.equal(r.saturado, false);
});

test("dO/dt: diferencial positivo pero por debajo del umbral => no saturado (tolerancia)", () => {
  const r = calcularBalanceFlujo(5, 4.8, 0.5);
  assert.ok(r.diferencial > 0);
  assert.ok(r.diferencial < r.umbralCritico);
  assert.equal(r.saturado, false);
});

test("dO/dt: diferencial igual al umbral crítico => saturado (umbral inclusivo)", () => {
  const r = calcularBalanceFlujo(5.5, 5, 0.5);
  assert.equal(r.diferencial, 0.5);
  assert.equal(r.saturado, true);
});

test("dO/dt: diferencial supera claramente el umbral => saturado, riesgo de colapso", () => {
  const r = calcularBalanceFlujo(10, 4, 0.5);
  assert.equal(r.diferencial, 6);
  assert.equal(r.saturado, true);
});

test("dO/dt: sin órdenes entrantes ni salientes (lambda = mu = 0) => no saturado", () => {
  const r = calcularBalanceFlujo(0, 0, 0.5);
  assert.equal(r.diferencial, 0);
  assert.equal(r.saturado, false);
});

test("dO/dt: el objeto retornado conserva lambda, mu y umbralCritico originales", () => {
  const r = calcularBalanceFlujo(7.25, 3.1, 0.5);
  assert.equal(r.lambda, 7.25);
  assert.equal(r.mu, 3.1);
  assert.equal(r.umbralCritico, 0.5);
});
