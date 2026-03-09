const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const forge = require("node-forge");
const crypto = require("crypto");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
/* ajuste de nombres segun tu cryptoHelper en minusculas */
const { decryptrsa, getpublickey } = require("../../../utils/cryptoHelper");

/* Llave Pública RSA para el cliente */
const getPublicKeyEndpoint = (req, res) => {
  res.json({ publicKey: getpublickey() });
};

/* Registro con hashing Bcrypt */
const register = async (req, res) => {
  try {
    const { nombre, email, password, matricula } = req.body;
    const existing = await User.findByEmail(email);
    if (existing)
      return res.status(400).json({ message: "Email ya registrado" });

    /* Encriptar contraseña con Bcrypt */
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await User.create({
      nombre,
      email,
      password: hashedPassword,
      matricula,
    });

    res.status(201).json({
      status: "success",
      message: "Usuario registrado con éxito",
      userId,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al registrar usuario" });
  }
};

/* Login con Cifrado Híbrido RSA/AES */
const login = async (req, res) => {
  try {
    const { email, encryptedPassword, encryptedAesKey, iv } = req.body;

    /* Desencriptar la llave AES que viene protegida con RSA */
    const aesKeyHex = decryptrsa(encryptedAesKey);

    /* Configurar el descifrador AES */
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
        .json({ message: "Error al descifrar la contraseña" });

    const passwordPlana = decipher.output.toString();

    /* Buscar usuario en la base de datos */
    const user = await User.findByEmail(email);
    if (!user)
      return res.status(401).json({ message: "Credenciales incorrectas" });

    /* Comparar contraseña plana contra el hash de la base de datos */
    const isMatch = await bcrypt.compare(passwordPlana, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Credenciales incorrectas" });

    /* buscar si el usuario ya tiene una foto de perfil en la base de datos */
    const userFiles = await User.getUserFiles(user.id);
    const fotoUrl = userFiles.length > 0 ? userFiles[0].url_archivo : null;

    /* Crear token JWT para la sesión */
    const token = jwt.sign(
      { id: user.id, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.json({
      status: "success",
      token,
      user: {
        nombre: user.nombre,
        rol: user.rol,
        email: user.email,
        fotoUrl: fotoUrl,
      },
    });
  } catch (error) {
    console.error("Error en servidor:", error.message);
    res.status(500).json({ message: "Error al iniciar sesión" });
  }
};

/* Subir archivos y generar hash SHA-256 */
const uploadSecureFile = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "No se subió ningún archivo" });

    /* Leer archivo y generar su huella digital SHA-256 */
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileHash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    /* Mostrar el hash en la consola del servidor */
    console.log("Firma del archivo:", fileHash);

    /* Preparar imagen para mandarla a ImgBB */
    const form = new FormData();
    form.append("image", fileBuffer.toString("base64"));

    /* Obtener API Key de ImgBB desde las variables de entorno */
    const IMGBB_KEY = process.env.IMGBB_API_KEY;

    /* Corregido: Se agregaron los headers del form para evitar el error 400 */
    const imgbbRes = await axios.post(
      `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
      },
    );
    const remoteUrl = imgbbRes.data.data.url;

    /* Guardar en la base de datos la URL y el hash del archivo */
    await User.registerFileHash(
      req.user.id,
      req.file.originalname,
      remoteUrl,
      fileHash,
    );

    fs.unlinkSync(req.file.path);

    res.json({
      status: "success",
      message: "Imagen subida y verificada",
      hash: fileHash,
      url: remoteUrl,
    });
  } catch (error) {
    /* Limpieza del archivo temporal en caso de error */
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error(
      "Error procesando archivo:",
      error.response?.data || error.message,
    );
    res.status(500).json({ message: "Error al subir la imagen" });
  }
};

/* Cerrar sesión del usuario */
const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) await User.deleteSession(token);
    res.json({ message: "Sesión cerrada" });
  } catch (error) {
    res.status(500).json({ message: "Error al cerrar sesión" });
  }
};
/* obtener perfil actualizado */
const getProfile = async (req, res) => {
  try {
    const user = await User.findByEmail(req.user.email);
    if (!user)
      return res.status(404).json({ message: "Usuario no encontrado" });

    const userFiles = await User.getUserFiles(user.id);
    const fotoUrl = userFiles.length > 0 ? userFiles[0].url_archivo : null;

    res.json({
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      fotoUrl: fotoUrl,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener perfil" });
  }
};

module.exports = {
  register,
  login,
  logout,
  getPublicKeyEndpoint,
  uploadSecureFile,
  getProfile,
};
