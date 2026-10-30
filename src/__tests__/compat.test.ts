import request from "supertest";
import jwt from "jsonwebtoken";

const fn = () => jest.fn();
const mockPrisma: any = {
  $queryRaw: jest.fn(async () => []),
  $transaction: jest.fn(async (arg: any) =>
    typeof arg === "function" ? arg(mockPrisma) : Promise.all(arg),
  ),
  user: {
    findUnique: fn(),
    findMany: fn(),
    update: fn(),
    count: fn(),
    groupBy: fn(),
  },
  product: {
    findMany: fn(),
    findUnique: fn(),
    update: fn(),
    updateMany: fn(),
    count: fn(),
    create: fn(),
    delete: fn(),
  },
  market: {
    findUnique: fn(),
    findMany: fn(),
    findFirst: fn(),
    count: fn(),
    create: fn(),
    update: fn(),
    updateMany: fn(),
    delete: fn(),
  },
  chat: {
    findFirst: fn(),
    findMany: fn(),
    create: fn(),
    update: fn(),
    deleteMany: fn(),
  },
  message: { create: fn(), updateMany: fn(), deleteMany: fn() },
  order: {
    findFirst: fn(),
    findMany: fn(),
    findUnique: fn(),
    update: fn(),
    updateMany: fn(),
    create: fn(),
    count: fn(),
    aggregate: fn(),
  },
  orderItem: { count: fn() },
  notificacion: {
    create: fn(),
    findFirst: fn(),
    findMany: fn(),
    updateMany: fn(),
    deleteMany: fn(),
  },
  activityLog: { create: fn(), findMany: fn() },
  contactoMensaje: {
    create: fn(),
    findMany: fn(),
    findUnique: fn(),
    update: fn(),
    count: fn(),
  },
  recommendation: { findMany: fn(), deleteMany: fn() },
  userFile: { findMany: fn(), create: fn() },
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

import app from "../../app";

const token = (id: string, rol: string, nombre = "Test") =>
  `Bearer ${jwt.sign({ id, rol, email: `${id}@test.mx`, nombre }, process.env.JWT_SECRET as string)}`;

const ALUMNO = token("alumno-1", "Al", "Ana Alumna");
const VENDEDOR = token("vendedor-1", "A_V", "Victor Vendedor");
const COCINA = token("cocina-1", "A_C", "Carla Cocina");
const ADMIN = token("admin-1", "A", "Adrian Admin");

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.notificacion.findFirst.mockResolvedValue(null);
  mockPrisma.notificacion.create.mockResolvedValue({ id: "n1" });
});

describe("Chat del Marketplace (antes roto en ambos frontends)", () => {
  const articulo = {
    id: "item-1",
    vendedorId: "vendedor-1",
    estatus: "activo",
    titulo: "Libro",
  };
  const chatCreado = {
    id: "chat-1",
    compradorId: "alumno-1",
    vendedorId: "vendedor-1",
    productoId: "item-1",
    producto: { id: "item-1", titulo: "Libro", imagenes: [], precio: 100 },
    mensajes: [],
  };

  it.each([
    ["Angular (camelCase)", { vendedorId: "vendedor-1", productoId: "item-1" }],
    ["Vite (snake_case)", { vendedor_id: "vendedor-1", producto_id: "item-1" }],
  ])("abre el chat con el formato de %s", async (_n, body) => {
    mockPrisma.market.findUnique.mockResolvedValue(articulo);
    mockPrisma.chat.findFirst.mockResolvedValue(null);
    mockPrisma.chat.create.mockResolvedValue(chatCreado);

    const res = await request(app)
      .post("/api/chat/open")
      .set("Authorization", ALUMNO)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("chat-1");
    expect(res.body._id).toBe("chat-1"); // alias leído por Vite
    expect(mockPrisma.chat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          compradorId: "alumno-1",
          vendedorId: "vendedor-1",
          productoId: "item-1",
        },
      }),
    );
  });

  it("toma el vendedor del artículo, no del cliente", async () => {
    mockPrisma.market.findUnique.mockResolvedValue(articulo);
    mockPrisma.chat.findFirst.mockResolvedValue(null);
    mockPrisma.chat.create.mockResolvedValue(chatCreado);

    await request(app)
      .post("/api/chat/open")
      .set("Authorization", ALUMNO)
      .send({ vendedorId: "otro-usuario", productoId: "item-1" });

    expect(mockPrisma.chat.create.mock.calls[0][0].data.vendedorId).toBe(
      "vendedor-1",
    );
  });

  it.each([
    ["Angular", { chatId: "chat-1", contenido: "Hola" }],
    ["Vite", { chat_id: "chat-1", text: "Hola" }],
  ])("envía mensajes con el formato de %s", async (_n, body) => {
    mockPrisma.chat.findFirst.mockResolvedValue({
      ...chatCreado,
      producto: { titulo: "Libro" },
    });
    mockPrisma.message.create.mockResolvedValue({
      id: "m1",
      chatId: "chat-1",
      sender_id: "alumno-1",
      text: "Hola",
    });
    mockPrisma.chat.update.mockResolvedValue({});

    const res = await request(app)
      .post("/api/chat/send")
      .set("Authorization", ALUMNO)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.text).toBe("Hola");
  });

  it("no deja escribir en un chat ajeno", async () => {
    mockPrisma.chat.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/chat/send")
      .set("Authorization", ALUMNO)
      .send({ chatId: "chat-ajeno", contenido: "hola" });
    expect(res.status).toBe(404);
    expect(mockPrisma.message.create).not.toHaveBeenCalled();
  });
});

describe("Órdenes / KDS", () => {
  it("GET /orders/ready existe y es solo para cocina", async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: "o1",
        status: "LISTO",
        items: [],
        user: { id: "alumno-1", nombre: "Ana" },
      },
    ]);
    const ok = await request(app)
      .get("/api/orders/ready")
      .set("Authorization", COCINA);
    expect(ok.status).toBe(200);
    expect(ok.body[0].usuarioNombre).toBe("Ana");

    const alumno = await request(app)
      .get("/api/orders/ready")
      .set("Authorization", ALUMNO);
    expect(alumno.status).toBe(403);
  });

  it("un alumno ya no puede ver comandas ni marcar órdenes como listas", async () => {
    expect(
      (
        await request(app)
          .get("/api/orders/kitchen")
          .set("Authorization", ALUMNO)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .put("/api/orders/ready/o1")
          .set("Authorization", ALUMNO)
      ).status,
    ).toBe(403);
  });

  it.each([
    ["qrData (Vite)", "qrData"],
    ["qrCodeData (Angular)", "qrCodeData"],
  ])("verify-qr acepta %s y lo permite a cocina", async (_n, campo) => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: "o1",
      status: "LISTO",
      fechaListo: new Date(),
    });
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "o1",
      userId: "alumno-1",
      status: "ENTREGADO",
      items: [],
    });

    const res = await request(app)
      .post("/api/orders/verify-qr")
      .set("Authorization", COCINA)
      .send({ [campo]: "qr-abc123" });

    expect(res.status).toBe(200);
    expect(mockPrisma.order.findFirst.mock.calls[0][0].where.qrCodeData).toBe(
      "QR-ABC123",
    );
  });

  it("/orders/activa no devuelve el carrito como orden en curso", async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .get("/api/orders/activa")
      .set("Authorization", ALUMNO);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ordenActiva: null });
    expect(mockPrisma.order.findFirst.mock.calls[0][0].where.status).toEqual({
      in: ["PAGADO", "LISTO"],
    });
  });

  it("guardar un carrito vacío es válido (antes respondía 400)", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.order.findFirst.mockResolvedValue({ id: "cart-1" });
    mockPrisma.order.update.mockResolvedValue({
      id: "cart-1",
      total: 0,
      items: [],
    });

    const res = await request(app)
      .post("/api/orders/cart")
      .set("Authorization", ALUMNO)
      .send({ items: [], total: 0 });
    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);
  });

  it("el total del carrito se calcula con precios de la BD, no del cliente", async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      { id: "p1", nombre: "Torta", precio: 50, tipo: "Cafeteria" },
    ]);
    mockPrisma.order.findFirst.mockResolvedValue(null);
    mockPrisma.order.create.mockImplementation(async ({ data }: any) => ({
      id: "cart-1",
      total: data.total,
      items: [],
    }));

    await request(app)
      .post("/api/orders/cart")
      .set("Authorization", ALUMNO)
      .send({ items: [{ productId: "p1", cantidad: 2, precio: 1 }], total: 2 });

    expect(mockPrisma.order.create.mock.calls[0][0].data.total).toBe(100);
  });

  it("checkout es idempotente si el alumno recarga la confirmación", async () => {
    mockPrisma.order.findFirst
      .mockResolvedValueOnce(null) // sin carrito
      .mockResolvedValueOnce({
        id: "o9",
        qrCodeData: "QR-1",
        total: 80,
        tiempoEstimadoMin: 10,
        items: [],
      });

    const res = await request(app)
      .post("/api/orders/checkout")
      .set("Authorization", ALUMNO)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "success",
      yaProcesada: true,
      orderId: "o9",
    });
  });
});

describe("Marketplace", () => {
  it("el admin general (A) también puede publicar, igual que en ambos frontends", async () => {
    mockPrisma.market.create.mockResolvedValue({
      id: "item-2",
      titulo: "Calculadora",
    });
    const res = await request(app)
      .post("/api/market/publish")
      .set("Authorization", ADMIN)
      .send({
        titulo: "Calculadora",
        precio: 300,
        descripcion: "Casi nueva",
        categoria: "Útiles",
      });
    expect(res.status).toBe(201);
    expect(res.body.item._id).toBe("item-2");
  });

  it("un alumno sin verificar no puede publicar", async () => {
    const res = await request(app)
      .post("/api/market/publish")
      .set("Authorization", ALUMNO)
      .send({ titulo: "Algo", precio: 10 });
    expect(res.status).toBe(403);
  });

  it("valida precio y título al publicar", async () => {
    const res = await request(app)
      .post("/api/market/publish")
      .set("Authorization", VENDEDOR)
      .send({ titulo: "X", precio: -5 });
    expect(res.status).toBe(400);
    expect(mockPrisma.market.create).not.toHaveBeenCalled();
  });
});

describe("Contacto", () => {
  it("cualquiera puede enviar un mensaje válido", async () => {
    mockPrisma.contactoMensaje.create.mockResolvedValue({
      id: "c1",
      nombre: "Pepe",
      asunto: null,
    });
    const res = await request(app)
      .post("/api/contacto")
      .send({
        nombre: "Pepe",
        email: "pepe@correo.com",
        mensaje: "Hola, tengo una duda sobre mi pedido.",
      });
    expect(res.status).toBe(201);
  });

  it("rechaza mensajes inválidos", async () => {
    const res = await request(app)
      .post("/api/contacto")
      .send({ nombre: "P", email: "no-es-correo", mensaje: "hi" });
    expect(res.status).toBe(400);
  });

  it("A y A_C pueden leer los mensajes; un alumno no", async () => {
    mockPrisma.contactoMensaje.findMany.mockResolvedValue([]);
    expect(
      (await request(app).get("/api/contacto").set("Authorization", ADMIN))
        .status,
    ).toBe(200);
    expect(
      (await request(app).get("/api/contacto").set("Authorization", COCINA))
        .status,
    ).toBe(200);
    expect(
      (await request(app).get("/api/contacto").set("Authorization", ALUMNO))
        .status,
    ).toBe(403);
    expect((await request(app).get("/api/contacto")).status).toBe(401);
  });
});

describe("Seguridad y datos sensibles", () => {
  it("/auth/profile ya no expone el hash de la contraseña ni el secreto 2FA", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "alumno-1",
      nombre: "Ana",
      password: "$2b$10$hash",
      two_factor_secret: "SECRETO",
      userFiles: [{ url_archivo: "https://img/foto.png" }],
    });
    const res = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", ALUMNO);
    expect(res.status).toBe(200);
    expect(res.body.password).toBeUndefined();
    expect(res.body.two_factor_secret).toBeUndefined();
    expect(res.body.fotoUrl).toBe("https://img/foto.png");
  });

  it("/admin/users tampoco expone contraseñas", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u1", nombre: "X", password: "hash", two_factor_secret: "s" },
    ]);
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", ADMIN);
    expect(res.status).toBe(200);
    expect(res.body[0].password).toBeUndefined();
  });

  it("los toggles de admin devuelven el usuario actualizado", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ nombre: "Ana" });
    mockPrisma.user.update.mockResolvedValue({
      id: "alumno-1",
      nombre: "Ana",
      es_becado: true,
      password: "h",
    });
    const res = await request(app)
      .patch("/api/admin/beca/alumno-1")
      .set("Authorization", ADMIN)
      .send({ esBecado: true });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: "alumno-1", es_becado: true });
    expect(res.body.user.password).toBeUndefined();
  });

  it("ya no existe la ruta abierta POST /ia/a para entrenar sin sesión", async () => {
    const res = await request(app).post("/api/ia/a");
    expect(res.status).toBe(404);
  });

  it("/auth/profile y /public-key no consumen el límite anti fuerza bruta", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "alumno-1",
      nombre: "Ana",
      userFiles: [],
    });
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", ALUMNO);
      expect(res.status).toBe(200);
    }
  });

  it("CORS acepta el origen de desarrollo de Angular", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/cafe/items")
      .set("Origin", "http://localhost:4200");
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:4200",
    );
  });
});

describe("Productos de cafetería", () => {
  it("editar ignora campos no permitidos (id, vendedorId...)", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "p1",
      tipo: "Cafeteria",
      vendedorId: "cocina-1",
    });
    mockPrisma.product.update.mockResolvedValue({ id: "p1", esMenuBeca: true });

    const res = await request(app)
      .put("/api/cafe/edit/p1")
      .set("Authorization", COCINA)
      .send({
        esMenuBeca: true,
        id: "hack",
        vendedorId: "otro",
        created_at: "x",
      });

    expect(res.status).toBe(200);
    expect(mockPrisma.product.update.mock.calls[0][0].data).toEqual({
      esMenuBeca: true,
    });
  });

  it("eliminar un producto con historial lo archiva en lugar de romper", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "p1",
      tipo: "Cafeteria",
      vendedorId: "cocina-1",
    });
    mockPrisma.orderItem.count.mockResolvedValue(3);
    mockPrisma.product.update.mockResolvedValue({
      id: "p1",
      estado: "AGOTADO",
    });

    const res = await request(app)
      .delete("/api/cafe/remove/p1")
      .set("Authorization", COCINA);
    expect(res.status).toBe(200);
    expect(res.body.archivado).toBe(true);
    expect(mockPrisma.product.delete).not.toHaveBeenCalled();
  });
});
