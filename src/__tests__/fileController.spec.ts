import { uploadProfileImage } from "../api/controllers/fileController";
import prisma from "../lib/prismaClient";
import fs from "fs";
import axios from "axios";
import { Request, Response } from "express";

// Mocks
jest.mock("../lib/prismaClient", () => ({
  userFile: { create: jest.fn() },
}));
jest.mock("fs");
jest.mock("axios");

describe("File Controller", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
    // Mock default para fs
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from("fake-image"));
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  it("debería fallar si no hay archivo en la request", async () => {
    mockReq = { file: undefined };
    await uploadProfileImage(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it("debería fallar si el usuario no está autenticado", async () => {
    mockReq = { file: { path: "test.jpg" } as any, user: undefined };
    await uploadProfileImage(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it("debería subir imagen a ImgBB y guardar en DB", async () => {
    mockReq = {
      file: { path: "test.jpg", originalname: "perfil.jpg" } as any,
      user: { id: "u1" } as any,
    };

    (axios.post as jest.Mock).mockResolvedValue({
      data: { data: { url: "http://img.com/a.jpg" } },
    });

    await uploadProfileImage(mockReq as Request, mockRes as Response);

    expect(prisma.userFile.create).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(fs.unlinkSync).toHaveBeenCalledWith("test.jpg");
  });

  it("debería manejar errores de API de terceros y limpiar archivo", async () => {
    mockReq = {
      file: { path: "test.jpg" } as any,
      user: { id: "u1" } as any,
    };

    (axios.post as jest.Mock).mockRejectedValue(new Error("ImgBB error"));

    await uploadProfileImage(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(fs.unlinkSync).toHaveBeenCalledWith("test.jpg");
  });
});
