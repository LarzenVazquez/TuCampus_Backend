import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import forge from "node-forge";
import crypto from "crypto";
import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import prisma from "../../lib/prismaClient";
import { decryptrsa, getpublickey } from "../../utils/cryptoHelper";
import { sendEmail } from "../../lib/emailService";

// Interfaz local para evitar errores de compilación
interface AuthenticatedRequest extends Request {
  user?: { id: string; rol: string; email: string; nombre: string };
}

/* 1. Llave Pública RSA */
export const getPublicKeyEndpoint = (_req: Request, res: Response) => {
  res.json({ publicKey: getpublickey() });
};

/* 2. REGISTRO */
export const register = async (req: Request, res: Response) => {
  try {
    const { nombre, email, password, matricula } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return res.status(400).json({ message: "Email ya registrado" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: { nombre, email, password: hashedPassword, matricula, rol: "Al" },
    });

    const verifyToken = jwt.sign({ email }, process.env.JWT_SECRET as string, {
      expiresIn: "24h",
    });
    const verifyLink = `https://tucampus.vercel.app/auth/verify-email.html?token=${verifyToken}`;

    await sendEmail(
      email,
      "TuCampus - Verifica tu correo",
      `<h2>¡Bienvenido!</h2><a href="${verifyLink}">Verificar cuenta</a>`,
    );

    res.status(201).json({
      status: "success",
      message: "Usuario registrado.",
      userId: newUser.id,
    });
  } catch (error: any) {
    console.error("❌ ERROR REGISTRO:", error);
    res
      .status(500)
      .json({ message: "Error al registrar", error: error.message });
  }
};

/* 3. VERIFICAR EMAIL */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query as { token: string };
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      email: string;
    };
    await prisma.user.update({
      where: { email: decoded.email },
      data: { email_verificado: true },
    });
    res.json({ message: "¡Correo verificado!" });
  } catch (error: any) {
    console.error("❌ ERROR VERIFY EMAIL:", error);
    res.status(400).json({ error: "El enlace expiró o es inválido." });
  }
};

/* 4. LOGIN */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, encryptedPassword, encryptedAesKey, iv, captchaToken } =
      req.body;

    if (!captchaToken)
      return res.status(400).json({ message: "Captcha requerido." });

    const captchaRes = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: captchaToken,
        },
      },
    );

    if (!captchaRes.data.success)
      return res.status(401).json({ message: "Captcha fallido" });

    const aesKeyHex = decryptrsa(encryptedAesKey);
    const decipher = forge.cipher.createDecipher(
      "AES-CBC",
      forge.util.hexToBytes(aesKeyHex),
    );
    decipher.start({ iv: forge.util.hexToBytes(iv) });
    decipher.update(
      forge.util.createBuffer(forge.util.decode64(encryptedPassword)),
    );
    decipher.finish();

    const passwordPlana = decipher.output.toString();
    const user = await prisma.user.findUnique({
      where: { email },
      include: { archivos: true },
    });

    if (!user || !(await bcrypt.compare(passwordPlana, user.password))) {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    if (!user.email_verificado) {
      return res.status(403).json({ message: "Verifica tu correo" });
    }

    const token = jwt.sign(
      { id: user.id, rol: user.rol, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: "24h" },
    );

    return res.status(200).json({
      // Aseguramos el status 200 explícito
      status: "success",
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        rol: user.rol,
        email: user.email,
        // Protegemos el acceso al índice 0
        fotoUrl:
          user.archivos && user.archivos.length > 0
            ? user.archivos[0].url_archivo
            : null,
        vendedor_verificado: user.vendedor_verificado,
      },
    });
  } catch (error: any) {
    console.error("❌ ERROR LOGIN DETALLADO:", error);
    return res
      .status(500)
      .json({ message: "Error al iniciar sesión", error: error.message });
  }
};

/* 5. SUBIDA DE ARCHIVOS */
export const uploadSecureFile = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (!authReq.file || !authReq.user)
      return res.status(400).json({ message: "Archivo o usuario no válido" });

    const fileBuffer = fs.readFileSync(authReq.file.path);
    const fileHash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    const form = new FormData();
    form.append("image", fileBuffer.toString("base64"));
    const imgbbRes = await axios.post(
      `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
      form,
      { headers: form.getHeaders() },
    );

    await prisma.userFile.create({
      data: {
        userId: authReq.user.id,
        nombre_archivo: authReq.file.originalname,
        url_archivo: imgbbRes.data.data.url,
        file_hash: fileHash,
        tipo_archivo: "perfil",
      },
    });

    fs.unlinkSync(authReq.file.path);
    res.json({ status: "success", url: imgbbRes.data.data.url });
  } catch (error: any) {
    console.error("❌ ERROR UPLOAD:", error);
    if (authReq.file) fs.unlinkSync(authReq.file.path);
    res.status(500).json({ message: "Error al subir", error: error.message });
  }
};

/* 6. PERFIL Y SESIONES */
export const getProfile = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) return res.status(401).json({ message: "No autorizado" });

  const user = await prisma.user.findUnique({
    where: { id: authReq.user.id },
    include: { archivos: true },
  });
  res.json({ ...user, fotoUrl: user?.archivos[0]?.url_archivo });
};

export const logout = async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) await prisma.session.deleteMany({ where: { token } });
  res.json({ message: "Sesión cerrada" });
};

export const changePassword = async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const {
      encryptedCurrentPassword,
      encryptedNewPassword,
      encryptedAesKey,
      iv,
    } = authReq.body;
    const aesKey = forge.util.hexToBytes(decryptrsa(encryptedAesKey));
    const ivBytes = forge.util.hexToBytes(iv);

    const decrypt = (enc: string) => {
      const d = forge.cipher.createDecipher("AES-CBC", aesKey);
      d.start({ iv: ivBytes });
      d.update(forge.util.createBuffer(forge.util.decode64(enc)));
      d.finish();
      return d.output.toString();
    };

    const user = await prisma.user.findUnique({
      where: { id: authReq.user?.id },
    });
    if (
      !user ||
      !(await bcrypt.compare(decrypt(encryptedCurrentPassword), user.password))
    )
      return res.status(400).json({ message: "Contraseña actual incorrecta" });

    const hashedNewPassword = await bcrypt.hash(
      decrypt(encryptedNewPassword),
      10,
    );
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword },
    });
    res.json({ message: "Contraseña actualizada" });
  } catch (error: any) {
    console.error("❌ ERROR CHANGE PASSWORD:", error);
    res.status(500).json({ message: "Error interno", error: error.message });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const resetToken = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET as string,
        { expiresIn: "1h" },
      );
      await sendEmail(
        email,
        "Recuperación",
        `<a href=".../${resetToken}">Reset</a>`,
      );
    }
    res.json({ message: "Correo enviado si existe la cuenta." });
  } catch (error: any) {
    console.error("❌ ERROR FORGOT PASSWORD:", error);
    res.status(500).json({ message: "Error interno", error: error.message });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
    };
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: decoded.id },
      data: { password: hashed },
    });
    res.json({ message: "Contraseña restablecida" });
  } catch (error: any) {
    console.error("❌ ERROR RESET PASSWORD:", error);
    res.status(500).json({ message: "Error interno", error: error.message });
  }
};

export const authController = {
  getPublicKeyEndpoint,
  register,
  verifyEmail,
  login,
  uploadSecureFile,
  getProfile,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
};
