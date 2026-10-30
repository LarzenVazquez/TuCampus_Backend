import request from "supertest";
import jwt from "jsonwebtoken";

const fn = () => jest.fn();
const mockPrisma: any = {
  $queryRaw: jest.fn(async () => []),
  $transaction: jest.fn(async (arg: any) =>
    typeof arg === "function" ? arg(mockPrisma) : Promise.all(arg),
  ),
  user: { findUnique: fn(), update: fn() },
  order: {
    findFirst: fn(),
    findUnique: fn(),
    updateMany: fn(),
    count: fn(),
    findMany: fn(),
  },
  notificacion: { create: fn(), findFirst: fn() },
  activityLog: { create: fn() },
  imageFile: { findUnique: fn(), create: fn(), count: fn() },
  solicitudBeca: {
    findFirst: fn(),
    findMany: fn(),
    findUnique: fn(),
    create: fn(),
    update: fn(),
    groupBy: fn(),
  },
};

jest.mock("../lib/prismaClient", () => ({
  __esModule: true,
  default: mockPrisma,
}));
jest.mock("../lib/emailService", () => ({
  __esModule: true,
  sendEmail: jest.fn(async () => undefined),
}));

import app from "../../app";
import {
  ImagenError,
  detectarFormato,
  normalizarImagen,
} from "../services/imageStorage";

const token = (id: string, rol: string, nombre = "Test") =>
  `Bearer ${jwt.sign({ id, rol, email: `${id}@test.mx`, nombre }, process.env.JWT_SECRET as string)}`;

const ALUMNO = token("alumno-1", "Al", "Ana Alumna");
const COCINA = token("cocina-1", "A_C", "Carla Cocina");
const ADMIN = token("admin-1", "A", "Adrian Admin");

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.notificacion.findFirst.mockResolvedValue(null);
  mockPrisma.notificacion.create.mockResolvedValue({ id: "n1" });
  mockPrisma.activityLog.create.mockResolvedValue({});
  mockPrisma.order.count.mockResolvedValue(0);
  mockPrisma.order.findMany.mockResolvedValue([]);
});

describe("RQF25 - consulta y entrega por QR", () => {
  const CODIGO = "QR-A1B2C3D4E5F6";
  const orden = (status: string, extra: any = {}) => ({
    id: "orden-123456",
    qrCodeData: CODIGO,
    status,
    tipo: "Normal",
    total: 85,
    metodoPago: "Tarjeta",
    fecha: new Date(),
    fechaListo: status === "PAGADO" ? null : new Date(),
    fechaEntregado: null,
    tiempoEstimadoMin: 8,
    user: { id: "alumno-1", nombre: "Ana Alumna", matricula: "2024171010" },
    items: [
      {
        productId: "p1",
        nombre: "Chilaquiles",
        cantidad: 2,
        precio: 42.5,
        product: { imagenUrl: null },
      },
    ],
    ...extra,
  });

  it("valida el formato del código y responde 404 si no existe", async () => {
    expect(
      (
        await request(app)
          .get("/api/orders/qr/hola")
          .set("Authorization", COCINA)
      ).status,
    ).toBe(400);
    mockPrisma.order.findFirst.mockResolvedValue(null);
    expect(
      (
        await request(app)
          .get(`/api/orders/qr/${CODIGO}`)
          .set("Authorization", COCINA)
      ).status,
    ).toBe(404);
  });

  it("un pedido listo muestra alumno, productos y permite entregar", async () => {
    mockPrisma.order.findFirst.mockResolvedValue(orden("LISTO"));
    const res = await request(app)
      .get(`/api/orders/qr/${CODIGO.toLowerCase()}`)
      .set("Authorization", COCINA);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      puedeEntregar: true,
      aviso: null,
      alumno: { matricula: "2024171010" },
    });
    expect(res.body.items[0]).toMatchObject({
      nombre: "Chilaquiles",
      cantidad: 2,
    });
  });

  it("un pedido en preparación se consulta pero no se puede entregar", async () => {
    mockPrisma.order.findFirst.mockResolvedValue(orden("PAGADO"));
    const res = await request(app)
      .get(`/api/orders/qr/${CODIGO}`)
      .set("Authorization", ADMIN);
    expect(res.body).toMatchObject({
      puedeEntregar: false,
      estatusLegible: "En preparación",
    });

    mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.order.findUnique.mockResolvedValue(orden("PAGADO"));
    const entrega = await request(app)
      .post("/api/orders/verify-qr")
      .set("Authorization", COCINA)
      .send({ qrCodeData: CODIGO });
    expect(entrega.status).toBe(409);
    expect(entrega.body.message).toMatch(/aún no está listo/);
  });

  it("la entrega es atómica y el código no se puede reutilizar", async () => {
    mockPrisma.order.findFirst.mockResolvedValue(orden("LISTO"));
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.order.findUnique.mockResolvedValue(
      orden("ENTREGADO", { fechaEntregado: new Date() }),
    );
    const ok = await request(app)
      .post("/api/orders/verify-qr")
      .set("Authorization", COCINA)
      .send({ qrCodeData: CODIGO });
    expect(ok.status).toBe(200);
    expect(mockPrisma.order.updateMany.mock.calls[0][0].where).toEqual({
      id: "orden-123456",
      status: "LISTO",
    });

    mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });
    const otra = await request(app)
      .post("/api/orders/verify-qr")
      .set("Authorization", COCINA)
      .send({ qrCodeData: CODIGO });
    expect(otra.status).toBe(409);
    expect(otra.body.message).toMatch(/ya fue entregado/);
  });

  it("un alumno no puede consultar ni entregar pedidos por QR", async () => {
    expect(
      (
        await request(app)
          .get(`/api/orders/qr/${CODIGO}`)
          .set("Authorization", ALUMNO)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/orders/verify-qr")
          .set("Authorization", ALUMNO)
          .send({ qrCodeData: CODIGO })
      ).status,
    ).toBe(403);
  });
});
