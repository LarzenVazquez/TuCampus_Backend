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

describe("RQF24 - solicitud de beca alimenticia", () => {
  const valida = {
    matricula: "2024171010",
    telefono: "55 1234 5678",
    correo: "",
    motivo:
      "Mi familia tiene ingresos bajos y necesito apoyo para comer en el campus.",
  };

  it("valida los campos del formulario", async () => {
    const res = await request(app)
      .post("/api/becas/solicitudes")
      .set("Authorization", ALUMNO)
      .send({ matricula: "1", telefono: "x", motivo: "corto" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(3);
  });

  it("registra la solicitud y avisa al administrador", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      email: "alumno-1@test.mx",
      es_becado: false,
    });
    mockPrisma.solicitudBeca.findFirst.mockResolvedValue(null);
    mockPrisma.solicitudBeca.create.mockImplementation(
      async ({ data }: any) => ({ id: "s1", estatus: "Pendiente", ...data }),
    );
    const res = await request(app)
      .post("/api/becas/solicitudes")
      .set("Authorization", ALUMNO)
      .send(valida);
    expect(res.status).toBe(201);
    expect(res.body.solicitud.correo).toBe("alumno-1@test.mx");
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
  });

  it("no permite una segunda solicitud mientras haya una pendiente", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      email: "alumno-1@test.mx",
      es_becado: false,
    });
    mockPrisma.solicitudBeca.findFirst.mockResolvedValue({
      id: "s1",
      estatus: "Pendiente",
    });
    const res = await request(app)
      .post("/api/becas/solicitudes")
      .set("Authorization", ALUMNO)
      .send(valida);
    expect(res.status).toBe(409);
    expect(mockPrisma.solicitudBeca.create).not.toHaveBeenCalled();
  });

  it("cocina no puede enviar ni revisar solicitudes", async () => {
    expect(
      (
        await request(app)
          .post("/api/becas/solicitudes")
          .set("Authorization", COCINA)
          .send(valida)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch("/api/becas/solicitudes/s1")
          .set("Authorization", COCINA)
          .send({ decision: "Aprobada" })
      ).status,
    ).toBe(403);
  });

  it("el rechazo exige un motivo", async () => {
    const res = await request(app)
      .patch("/api/becas/solicitudes/s1")
      .set("Authorization", ADMIN)
      .send({ decision: "Rechazada", comentario: "" });
    expect(res.status).toBe(400);
  });

  it("al aprobar se activa es_becado y se notifica al alumno", async () => {
    const usuario = {
      id: "alumno-1",
      nombre: "Ana",
      email: "alumno-1@test.mx",
      matricula: "2024171010",
      es_becado: false,
    };
    mockPrisma.solicitudBeca.findUnique.mockResolvedValue({
      id: "s1",
      userId: "alumno-1",
      estatus: "Pendiente",
      user: usuario,
    });
    mockPrisma.solicitudBeca.update.mockImplementation(
      async ({ data }: any) => ({
        id: "s1",
        userId: "alumno-1",
        correo: "alumno-1@test.mx",
        ...data,
        user: { ...usuario, es_becado: true },
      }),
    );
    const res = await request(app)
      .patch("/api/becas/solicitudes/s1")
      .set("Authorization", ADMIN)
      .send({ decision: "Aprobada" });
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "alumno-1" },
      data: { es_becado: true },
    });
    expect(res.body.solicitud.user.es_becado).toBe(true);
    expect(mockPrisma.notificacion.create).toHaveBeenCalled();
  });

  it("una solicitud ya revisada no se puede volver a decidir", async () => {
    mockPrisma.solicitudBeca.findUnique.mockResolvedValue({
      id: "s1",
      userId: "alumno-1",
      estatus: "Aprobada",
      user: {},
    });
    const res = await request(app)
      .patch("/api/becas/solicitudes/s1")
      .set("Authorization", ADMIN)
      .send({ decision: "Rechazada", comentario: "Datos incompletos" });
    expect(res.status).toBe(409);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
