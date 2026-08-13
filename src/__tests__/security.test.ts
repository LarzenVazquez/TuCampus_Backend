import request from "supertest";

// Mock de Prisma Client
jest.mock("../lib/prismaClient", () => ({
  __esModule: true,
  default: {
    product: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  },
}));

import app from "../../app";

describe("DE.3 — Suite de Pruebas de Seguridad (Validación Local)", () => {
  it("Prueba 1: Debe rechazar tipos inválidos (no-string) en el parámetro de búsqueda", async () => {
    const response = await request(app).get(
      "/api/cafe/items/category/Cafeteria?search=a&search=b",
    );

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("message");
  });

  it("Prueba 2: Debe rechazar cadenas de búsqueda excesivamente largas para evitar saturación", async () => {
    const longString = "A".repeat(100);

    const response = await request(app)
      .get("/api/cafe/items/category/Cafeteria")
      .query({ search: longString });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("message");
  });

  it("Prueba 3: Debe denegar o no reflejar orígenes externos no autorizados", async () => {
    const response = await request(app)
      .get("/api/cafe/items")
      .set("Origin", "http://sitio-malicioso-externo.com");

    expect(response.headers["access-control-allow-origin"]).not.toBe(
      "http://sitio-malicioso-externo.com",
    );
  });

  it("Prueba 4: Debe manejar rutas inválidas de forma controlada sin exponer información interna", async () => {
    const response = await request(app).get(
      "/api/ruta-inexistente-para-probar-seguridad",
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Ruta no encontrada" });
    expect(JSON.stringify(response.body)).not.toMatch(/at\s+.*\(.*:\d+:\d+\)/);
  });

  it("Prueba 5: Debe activar el rate limiter contra fuerza bruta en /api/auth/login", async () => {
    const agent = request(app);
    let lastResponse;

    for (let i = 0; i < 12; i++) {
      lastResponse = await agent.post("/api/auth/login").send({
        email: "test@tucampus.com",
        password: "wrongpassword",
      });
    }

    expect(lastResponse?.status).toBe(429);
  });
});
