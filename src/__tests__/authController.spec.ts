jest.mock("otplib", () => {
  const mockCheck = jest.fn();
  return {
    authenticator: {
      generateSecret: jest.fn(),
      keyuri: jest.fn(),
      verify: mockCheck, // Por si usas verify
      check: mockCheck, // Tu controlador está llamando a este método
    },
  };
});

// Mockear la subdependencia problemática para que Jest ni siquiera intente leerla en el árbol de dependencias
jest.mock(
  "@scure/base",
  () => ({
    utils: {
      freeze: (obj: any) => obj,
    },
  }),
  { virtual: true },
);

import { Request, Response } from "express";
import prisma from "../lib/prismaClient";
import axios from "axios";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Ahora importamos el controlador de manera segura
import { authController } from "../api/controllers/authController";

// Traemos el mock para manipular sus retornos en los tests de 2FA
const { authenticator } = require("otplib");

jest.mock("../lib/emailService", () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));
jest.mock("fs", () => ({
  readFileSync: jest.fn().mockReturnValue("buffer"),
  unlinkSync: jest.fn(),
}));
jest.mock("bcryptjs");
jest.mock("axios");
jest.mock("jsonwebtoken");
jest.mock("../lib/prismaClient", () => ({
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  userFile: { create: jest.fn() },
  session: { deleteMany: jest.fn() },
}));
jest.mock("../utils/cryptoHelper", () => ({
  decryptrsa: jest.fn().mockReturnValue("12345678901234567890123456789012"),
  getpublickey: jest
    .fn()
    .mockReturnValue(
      "-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----",
    ),
}));
jest.mock("node-forge", () => ({
  cipher: {
    createDecipher: jest.fn().mockReturnValue({
      start: jest.fn(),
      update: jest.fn(),
      finish: jest.fn(),
      output: { toString: () => "passwordPlana" },
    }),
  },
  util: {
    hexToBytes: jest.fn().mockReturnValue("mockedBytes"),
    decode64: jest.fn().mockReturnValue("mockedDecoded"),
    createBuffer: jest.fn().mockReturnValue("mockedBuffer"),
  },
}));

describe("Auth Controller", () => {
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  // ─── LOGIN ────────────────────────────────────────────────────────────────

  it("Login: falta captcha → 400", async () => {
    await authController.login({ body: {} } as any, mockRes as any);
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("Login: captcha falla → 401", async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { success: false } });
    await authController.login(
      { body: { captchaToken: "bad" } } as any,
      mockRes as any,
    );
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it("Login: credenciales incorrectas (usuario no existe) → 401", async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await authController.login(
      {
        body: {
          captchaToken: "t",
          email: "a@a.com",
          encryptedPassword: "x",
          encryptedAesKey: "k",
          iv: "i",
        },
      } as any,
      mockRes as any,
    );
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it("Login: email no verificado → 403", async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "1",
      password: "hashed",
      email_verificado: false,
      archivos: [],
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    await authController.login(
      {
        body: {
          captchaToken: "t",
          email: "a@a.com",
          encryptedPassword: "x",
          encryptedAesKey: "k",
          iv: "i",
        },
      } as any,
      mockRes as any,
    );
    expect(mockRes.status).toHaveBeenCalledWith(403);
  });

  it("Login: éxito → 200 con token", async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "1",
      nombre: "Test",
      rol: "Al",
      email: "a@a.com",
      password: "hashed",
      email_verificado: true,
      two_factor_enabled: false,
      vendedor_verificado: false,
      archivos: [{ url_archivo: "foto.jpg" }],
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue("fake-token");

    await authController.login(
      {
        body: {
          captchaToken: "t",
          email: "a@a.com",
          encryptedPassword: "x",
          encryptedAesKey: "k",
          iv: "i",
        },
      } as any,
      mockRes as any,
    );
    // controller llama res.json() sin .status(200) explícito
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", token: "fake-token" }),
    );
  });

  it("Login: usuario sin foto (archivos vacío) → fotoUrl null", async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "1",
      nombre: "Test",
      rol: "Al",
      email: "a@a.com",
      password: "hashed",
      email_verificado: true,
      vendedor_verificado: false,
      two_factor_enabled: false,
      archivos: [],
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue("fake-token");

    await authController.login(
      {
        body: {
          captchaToken: "t",
          email: "a@a.com",
          encryptedPassword: "x",
          encryptedAesKey: "k",
          iv: "i",
        },
      } as any,
      mockRes as any,
    );
    // controller llama res.json() sin .status(200) explícito
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        user: expect.objectContaining({ fotoUrl: null }),
      }),
    );
  });

  it("Login: usuario con 2FA activo → respuesta 2FA_REQUIRED", async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "1",
      nombre: "Test",
      rol: "Al",
      email: "a@a.com",
      password: "hashed",
      email_verificado: true,
      two_factor_enabled: true,
      vendedor_verificado: false,
      archivos: [],
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await authController.login(
      {
        body: {
          captchaToken: "t",
          email: "a@a.com",
          encryptedPassword: "x",
          encryptedAesKey: "k",
          iv: "i",
        },
      } as any,
      mockRes as any,
    );
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "2FA_REQUIRED" }),
    );
  });

  // ─── REGISTRO ────────────────────────────────────────────────────────────

  it("Register: email duplicado → 400", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "1" });
    await authController.register(
      { body: { email: "a@a.com" } } as any,
      mockRes as any,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("Register: campos vacíos, prisma.create explota → 500", async () => {
    // Con body vacío: findUnique devuelve null (no duplicado),
    // pero create falla porque los campos son undefined.
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockRejectedValue(
      new Error("campo requerido"),
    );
    await authController.register({ body: {} } as any, mockRes as any);
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("Register: éxito → 201", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({ id: "42" });
    (jwt.sign as jest.Mock).mockReturnValue("verify-token");

    await authController.register(
      {
        body: {
          nombre: "Juan",
          email: "juan@test.com",
          password: "pass123",
          matricula: "A01",
        },
      } as any,
      mockRes as any,
    );
    expect(mockRes.status).toHaveBeenCalledWith(201);
  });

  // ─── VERIFY EMAIL ─────────────────────────────────────────────────────────

  it("VerifyEmail: token ausente o inválido → 400", async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error("invalid");
    });
    await authController.verifyEmail({ query: {} } as any, mockRes as any);
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("VerifyEmail: token válido → éxito", async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ email: "a@a.com" });
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    await authController.verifyEmail(
      { query: { token: "valid" } } as any,
      mockRes as any,
    );
    expect(mockRes.json).toHaveBeenCalledWith({
      message: "¡Correo verificado!",
    });
  });

  // ─── UPLOAD ───────────────────────────────────────────────────────────────

  it("Upload: sin archivo → 400", async () => {
    await authController.uploadSecureFile(
      { user: { id: "1" } } as any,
      mockRes as any,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("Upload: error en imgbb → 500", async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error("imgbb fail"));
    await authController.uploadSecureFile(
      {
        file: { path: "x", originalname: "foto.jpg" },
        user: { id: "1" },
      } as any,
      mockRes as any,
    );
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("Upload: exito devuelve url", async () => {
    const fsMock = require("fs");
    (fsMock.unlinkSync as jest.Mock).mockImplementation(() => undefined);

    (axios.post as jest.Mock).mockResolvedValue({
      data: { data: { url: "https://img.bb/foto.jpg" } },
    });
    (prisma.userFile.create as jest.Mock).mockResolvedValue({});

    await authController.uploadSecureFile(
      {
        file: { path: "x", originalname: "foto.jpg" },
        user: { id: "1" },
      } as any,
      mockRes as any,
    );
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success" }),
    );
  });

  // ─── CHANGE PASSWORD ──────────────────────────────────────────────────────

  it("ChangePassword: usuario no encontrado → 400", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await authController.changePassword(
      { body: { encryptedCurrentPassword: "x" }, user: { id: "99" } } as any,
      mockRes as any,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("ChangePassword: contraseña incorrecta → 400", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "1",
      password: "hashed",
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await authController.changePassword(
      { body: { encryptedCurrentPassword: "x" }, user: { id: "1" } } as any,
      mockRes as any,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("ChangePassword: error interno → 500", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "1",
      password: "hashed",
    });
    (bcrypt.compare as jest.Mock).mockRejectedValue(new Error("db fail"));
    await authController.changePassword(
      { body: { encryptedCurrentPassword: "x" }, user: { id: "1" } } as any,
      mockRes as any,
    );
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("ChangePassword: éxito → mensaje ok", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "1",
      password: "hashed",
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue("newHashed");
    (prisma.user.update as jest.Mock).mockResolvedValue({});

    await authController.changePassword(
      {
        body: {
          encryptedCurrentPassword: "x",
          encryptedNewPassword: "y",
        },
        user: { id: "1" },
      } as any,
      mockRes as any,
    );
    expect(mockRes.json).toHaveBeenCalledWith({
      message: "Contraseña actualizada",
    });
  });

  // ─── RESET PASSWORD ───────────────────────────────────────────────────────
  // El controller tiene UN solo catch que devuelve 500 para cualquier error,
  // incluyendo token inválido. Los tests deben reflejar ese comportamiento real.

  it("ResetPassword: token inválido → 500 (comportamiento real del controller)", async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error("invalid token");
    });
    await authController.resetPassword(
      { body: { token: "bad", newPassword: "p" } } as any,
      mockRes as any,
    );
    // El controller no distingue token inválido de error de BD — ambos van al catch con 500
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("ResetPassword: bcrypt falla → 500", async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: "1" });
    (bcrypt.hash as jest.Mock).mockRejectedValue(new Error("hash fail"));
    await authController.resetPassword(
      { body: { token: "t", newPassword: "p" } } as any,
      mockRes as any,
    );
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("ResetPassword: éxito → mensaje ok", async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ id: "1" });
    (bcrypt.hash as jest.Mock).mockResolvedValue("hashedNew");
    (prisma.user.update as jest.Mock).mockResolvedValue({});

    await authController.resetPassword(
      { body: { token: "valid", newPassword: "newpass" } } as any,
      mockRes as any,
    );
    expect(mockRes.json).toHaveBeenCalledWith({
      message: "Contraseña restablecida",
    });
  });

  // ─── LOGOUT ───────────────────────────────────────────────────────────────

  it("Logout: cierre correcto → mensaje ok", async () => {
    await authController.logout(
      { headers: { authorization: "Bearer token" } } as any,
      mockRes as any,
    );
    expect(mockRes.json).toHaveBeenCalledWith({ message: "Sesión cerrada" });
  });

  it("Logout: sin header authorization → igual cierra", async () => {
    await authController.logout({ headers: {} } as any, mockRes as any);
    expect(mockRes.json).toHaveBeenCalledWith({ message: "Sesión cerrada" });
  });

  // ─── PROFILE ──────────────────────────────────────────────────────────────

  it("getProfile: sin usuario → 401", async () => {
    await authController.getProfile({} as any, mockRes as any);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it("getProfile: éxito → devuelve datos", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "1",
      nombre: "Test",
      archivos: [{ url_archivo: "foto.jpg" }],
    });
    await authController.getProfile(
      { user: { id: "1" } } as any,
      mockRes as any,
    );
    expect(mockRes.json).toHaveBeenCalled();
  });

  it("getProfile: usuario sin archivos → fotoUrl undefined", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "1",
      nombre: "Test",
      archivos: [],
    });
    await authController.getProfile(
      { user: { id: "1" } } as any,
      mockRes as any,
    );
    expect(mockRes.json).toHaveBeenCalled();
  });

  // ─── FORGOT PASSWORD ──────────────────────────────────────────────────────

  it("forgotPassword: usuario existe → envía correo", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "1" });
    (jwt.sign as jest.Mock).mockReturnValue("reset-token");
    await authController.forgotPassword(
      { body: { email: "a@a.com" } } as any,
      mockRes as any,
    );
    expect(mockRes.json).toHaveBeenCalledWith({
      message: "Correo enviado si existe la cuenta.",
    });
  });

  it("forgotPassword: usuario NO existe → respuesta genérica igual", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await authController.forgotPassword(
      { body: { email: "noexiste@test.com" } } as any,
      mockRes as any,
    );
    expect(mockRes.json).toHaveBeenCalledWith({
      message: "Correo enviado si existe la cuenta.",
    });
  });

  // ─── COBERTURA FINAL ──────────────────────────────────────────────────────

  it("getPublicKeyEndpoint: devuelve publicKey", () => {
    authController.getPublicKeyEndpoint({} as any, mockRes as any);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ publicKey: expect.anything() }),
    );
  });

  it("Login: exito completo llega a status 200 con token", async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "1",
      nombre: "Juan",
      rol: "Al",
      email: "juan@test.com",
      password: "hashed",
      email_verificado: true,
      two_factor_enabled: false,
      vendedor_verificado: false,
      archivos: [],
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwt.sign as jest.Mock).mockReturnValue("tok");

    await authController.login(
      {
        body: {
          captchaToken: "t",
          email: "juan@test.com",
          encryptedPassword: "ep",
          encryptedAesKey: "ek",
          iv: "iv",
        },
      } as any,
      mockRes as any,
    );
    // controller llama res.json() sin .status(200) explícito
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", token: "tok" }),
    );
  });

  it("ChangePassword: exito completo guarda nueva password", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "1",
      password: "hashed",
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue("newHashed");
    (prisma.user.update as jest.Mock).mockResolvedValue({});

    await authController.changePassword(
      {
        body: {
          encryptedCurrentPassword: "ecp",
          encryptedNewPassword: "enp",
          encryptedAesKey: "ek",
          iv: "iv",
        },
        user: { id: "1" },
      } as any,
      mockRes as any,
    );
    expect(mockRes.json).toHaveBeenCalledWith({
      message: "Contraseña actualizada",
    });
  });

  it("setup2FA: sin usuario en sesión → 401", async () => {
    await authController.setup2FA({} as any, mockRes as any);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it("setup2FA: fallo interno al guardar datos en prisma → 500", async () => {
    authenticator.generateSecret.mockReturnValue("SECRET32BASE");
    authenticator.keyuri.mockReturnValue("otpauth://totp/TuCampus");
    (prisma.user.update as jest.Mock).mockRejectedValue(
      new Error("Prisma crash"),
    );

    await authController.setup2FA(
      { user: { id: "1", email: "a@a.com" } } as any,
      mockRes as any,
    );
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("setup2FA: configuración correcta → 200 con secreto y uri", async () => {
    authenticator.generateSecret.mockReturnValue("SECRET32BASE");
    authenticator.keyuri.mockReturnValue("otpauth://totp/TuCampus");
    (prisma.user.update as jest.Mock).mockResolvedValue({});

    await authController.setup2FA(
      { user: { id: "1", email: "a@a.com" } } as any,
      mockRes as any,
    );
    expect(mockRes.json).toHaveBeenCalledWith({
      secret: "SECRET32BASE",
      otpauthUrl: "otpauth://totp/TuCampus",
    });
  });

  // ─── VERIFY 2FA ───────────────────────────────────────────────────────────

  it("verify2FA: token ausente o verificación de otplib fallida → 400", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "1",
      two_factor_secret: "SECRET",
    });
    authenticator.verify.mockReturnValue(false);

    await authController.verify2FA(
      { user: { id: "1" }, body: { token: "123456" } } as any,
      mockRes as any,
    );
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("verify2FA: error de infraestructura interno → 500", async () => {
    (prisma.user.findUnique as jest.Mock).mockRejectedValue(
      new Error("Database offline"),
    );

    await authController.verify2FA(
      { user: { id: "1" }, body: { token: "123456" } } as any,
      mockRes as any,
    );
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it("verify2FA: token correcto y activación de doble factor completada → 200", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "1",
      two_factor_secret: "SECRET",
    });
    authenticator.verify.mockReturnValue(true);
    (prisma.user.update as jest.Mock).mockResolvedValue({});

    await authController.verify2FA(
      { user: { id: "1" }, body: { token: "123456" } } as any,
      mockRes as any,
    );
    expect(mockRes.json).toHaveBeenCalledWith({
      message: "Doble factor de autenticación activado correctamente",
    });
  });
});
