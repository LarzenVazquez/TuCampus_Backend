import request from "supertest";
import jwt from "jsonwebtoken";
import sharp from "sharp";

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
  market: { create: fn(), count: fn(), update: fn(), findUnique: fn() },
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
const VENDEDOR = token("vendedor-1", "A_V", "Victor Vendedor");
const ADMIN = token("admin-1", "A", "Adrian Admin");

const ID_IMG = "0b9f2a3c-1d2e-4f50-8a6b-7c8d9e0f1a2b";

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.notificacion.findFirst.mockResolvedValue(null);
  mockPrisma.notificacion.create.mockResolvedValue({ id: "n1" });
  mockPrisma.activityLog.create.mockResolvedValue({});
  mockPrisma.order.count.mockResolvedValue(0);
  mockPrisma.order.findMany.mockResolvedValue([]);
});

describe("RNF-15 - almacenamiento propio de imágenes", () => {
  let png: Buffer;
  beforeAll(async () => {
    png = await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: "#0e6b4c" },
    })
      .png()
      .toBuffer();
  });

  it("detecta el formato real por los primeros bytes", async () => {
    const jpg = await sharp(png).jpeg().toBuffer();
    expect(detectarFormato(png)).toBe("png");
    expect(detectarFormato(jpg)).toBe("jpeg");
    expect(detectarFormato(Buffer.from("GIF89a-----"))).toBeNull();
  });

  it("cocina sube un PNG: se redimensiona y se responde con URL propia absoluta", async () => {
    mockPrisma.imageFile.findUnique.mockResolvedValue(null);
    mockPrisma.imageFile.create.mockImplementation(async ({ data }: any) => ({
      id: data.id,
      mime: data.mime,
      bytes: data.bytes,
      width: data.width,
      height: data.height,
    }));
    const res = await request(app)
      .post("/api/cafe/images")
      .set("Authorization", COCINA)
      .attach("image", png, { filename: "foto.png", contentType: "image/png" });
    expect(res.status).toBe(201);
    expect(res.body.width).toBe(1600);
    expect(res.body.url).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/api\/images\/[0-9a-f-]{36}$/,
    );
    expect(mockPrisma.imageFile.create.mock.calls[0][0].data.modulo).toBe(
      "producto",
    );
  });

  it("rechaza formatos no permitidos, archivos falsos y la falta de archivo", async () => {
    const gif = await request(app)
      .post("/api/cafe/images")
      .set("Authorization", COCINA)
      .attach("image", Buffer.from("GIF89a"), {
        filename: "a.gif",
        contentType: "image/gif",
      });
    expect(gif.status).toBe(415);

    const falso = await request(app)
      .post("/api/cafe/images")
      .set("Authorization", COCINA)
      .attach("image", Buffer.from("no soy una imagen"), {
        filename: "a.png",
        contentType: "image/png",
      });
    expect(falso.status).toBe(415);

    const vacio = await request(app)
      .post("/api/cafe/images")
      .set("Authorization", COCINA);
    expect(vacio.status).toBe(400);
  });

  it("un alumno no puede subir imágenes del menú", async () => {
    const res = await request(app)
      .post("/api/cafe/images")
      .set("Authorization", ALUMNO)
      .attach("image", png, { filename: "foto.png", contentType: "image/png" });
    expect(res.status).toBe(403);
  });

  it("normaliza valores de imagen y bloquea direcciones internas (SSRF)", async () => {
    await expect(
      normalizarImagen(`/api/images/${ID_IMG}`, "producto"),
    ).resolves.toBe(`/api/images/${ID_IMG}`);
    await expect(normalizarImagen("  ", "producto")).resolves.toBe("");
    mockPrisma.imageFile.count.mockResolvedValue(1);
    await expect(
      normalizarImagen(
        `https://api.tucampus.mx/api/images/${ID_IMG}`,
        "producto",
      ),
    ).resolves.toBe(`/api/images/${ID_IMG}`);
    for (const url of [
      "http://127.0.0.1/x.png",
      "http://169.254.169.254/latest/meta-data",
      "http://10.0.0.5/a.jpg",
    ]) {
      await expect(normalizarImagen(url, "marketplace")).rejects.toBeInstanceOf(
        ImagenError,
      );
    }
    await expect(
      normalizarImagen("file:///etc/passwd", "producto"),
    ).rejects.toBeInstanceOf(ImagenError);
  });

  it("una imagen inexistente responde 404", async () => {
    mockPrisma.imageFile.findUnique.mockResolvedValue(null);
    expect((await request(app).get(`/api/images/${ID_IMG}`)).status).toBe(404);
    expect((await request(app).get("/api/images/../../etc")).status).toBe(404);
  });
});
