const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const forge = require("node-forge");
const crypto = require("crypto");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const { decryptRSA, getPublicKey } = require("../../../utils/cryptoHelper");

// Requisito B: Entrega de Llave Pública RSA
const getPublicKeyEndpoint = (req, res) => {
  res.json({ publicKey: getPublicKey() });
};

// Requisito A: Registro con Hashing Bcrypt (30 pts)
const register = async (req, res) => {
  try {
    const { nombre, email, password, matricula } = req.body;
    const existing = await User.findByEmail(email);
    if (existing)
      return res.status(400).json({ message: "Email ya registrado" });

    const hashedPassword = await bcrypt.hash(password, 10); // Factor de trabajo 10

    const userId = await User.create({
      nombre,
      email,
      password: hashedPassword,
      matricula,
    });

    res.status(201).json({
      status: "success",
      message: "Usuario creado con Bcrypt",
      userId,
    });
  } catch (error) {
    res.status(500).json({ message: "Error en registro" });
  }
};

// Requisito B: Login con Cifrado Híbrido RSA/AES (50 pts)
const login = async (req, res) => {
  try {
    const { email, encryptedPassword, encryptedAesKey, iv } = req.body;

    // 1. Descifrar la llave AES que viene en RSA
    const aesKeyHex = decryptRSA(encryptedAesKey);

    // 2. Configurar el descifrador AES
    const keyBytes = forge.util.hexToBytes(aesKeyHex);
    const ivBytes = forge.util.hexToBytes(iv);
    const encryptedPassBytes = forge.util.decode64(encryptedPassword);

    const decipher = forge.cipher.createDecipher("AES-CBC", keyBytes);
    decipher.start({ iv: ivBytes });
    decipher.update(forge.util.createBuffer(encryptedPassBytes));

    const result = decipher.finish();
    if (!result)
      return res
        .status(400)
        .json({ message: "Error al finalizar descifrado AES" });

    const passwordPlana = decipher.output.toString();

    // 3. Buscar usuario
    const user = await User.findByEmail(email);
    if (!user)
      return res.status(401).json({ message: "Usuario no encontrado" });

    // 4. Comparar Bcrypt (Punto A)
    const isMatch = await bcrypt.compare(passwordPlana, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Contraseña incorrecta" });

    // 5. JWT y Respuesta
    const token = jwt.sign(
      { id: user.id, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.json({
      status: "success",
      token,
      user: { nombre: user.nombre, rol: user.rol, email: user.email },
    });
  } catch (error) {
    console.error("LOG DE ERROR EN SERVIDOR:", error.message);
    res
      .status(500)
      .json({ message: "Error en el login seguro", detail: error.message });
  }
};

// Requisito C: Subida de Archivo con Hash SHA-256 (20 pts)
const uploadSecureFile = async (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ message: "No seleccionaste ningún archivo" });

    // --- REQUISITO C: INTEGRIDAD (SHA-256) ---
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileHash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    // Impresión simple para validación en vivo solicitado
    console.log("SHA del archivo:", fileHash);

    // --- INTEGRACIÓN IMGBB ---
    const form = new FormData();
    form.append("image", fileBuffer.toString("base64"));

    const IMGBB_KEY = "e2caeade9fd380f7e9298cfba219a490";
    const imgbbRes = await axios.post(
      `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`,
      form,
    );
    const remoteUrl = imgbbRes.data.data.url;

    // Registro en SQL con la URL de ImgBB y el Hash
    await User.registerFileHash(
      req.user.id,
      req.file.originalname,
      remoteUrl,
      fileHash,
    );

    // Borrar archivo temporal
    fs.unlinkSync(req.file.path);

    res.json({
      status: "success",
      message: "Archivo verificado e integrado",
      hash: fileHash,
      url: remoteUrl,
    });
  } catch (error) {
    console.error("Error en Requisito C:", error.message);
    res.status(500).json({ message: "Error al procesar el archivo" });
  }
};

const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) await User.deleteSession(token);
    res.json({ message: "Sesión cerrada" });
  } catch (error) {
    res.status(500).json({ message: "Error en logout" });
  }
};

module.exports = {
  register,
  login,
  logout,
  getPublicKeyEndpoint,
  uploadSecureFile,
};
