const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const forge = require("node-forge");
const crypto = require("crypto");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const { decryptrsa, getpublickey } = require("../../../utils/cryptoHelper");
const nodemailer = require("nodemailer");

/* Llave Pública RSA para el cliente */
const getPublicKeyEndpoint = (req, res) => {
  res.json({ publicKey: getpublickey() });
};

// Configuración corregida para evitar el error ENETUNREACH en Railway
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, 
  },
  family: 4,
});

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
      rol: "Al", // Se asegura el rol por defecto según la nueva BD
      vendedor_verificado: 0, // Se asegura el estado inicial
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
      { id: user.id, rol: user.rol, email: user.email }, // Ahora inyecta 'A', 'A_C', 'Al' o 'A_V'
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.json({
      status: "success",
      token,
      user: {
        nombre: user.nombre,
        rol: user.rol, // Devuelve la sigla para el Frontend
        email: user.email,
        fotoUrl: fotoUrl,
        vendedor_verificado: user.vendedor_verificado, // Nueva columna incluida
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
    // req.user.id viene del JWT decodificado por el middleware
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const userFiles = await User.getUserFiles(user.id);
    const fotoUrl = userFiles.length > 0 ? userFiles[0].url_archivo : null;

    res.json({
      nombre: user.nombre,
      email: user.email,
      rol: user.rol.trim(), // Limpieza de siglas (A, Al, A_V, A_C)
      fotoUrl: fotoUrl,
      vendedor_verificado: user.vendedor_verificado,
    });
  } catch (error) {
    console.error("Error en controlador getProfile:", error.message);
    res.status(500).json({ message: "Error al obtener perfil" });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch)
      return res
        .status(401)
        .json({ error: "La contraseña actual es incorrecta" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updatePassword(userId, hashed);

    res.json({ message: "Contraseña actualizada con éxito" });
  } catch (error) {
    res.status(500).json({ error: "Error interno al cambiar contraseña" });
  }
};

// Función para solicitar reseteo
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findByEmail(email);

    // Por seguridad, siempre respondemos que se envió el correo, exista o no
    if (!user)
      return res.json({ message: "Correo enviado si existe la cuenta." });

    // LA SOLUCIÓN: Generar un JWT real que expira en 1 hora, llevando oculto el ID del usuario
    const resetToken = jwt.sign(
      { id: user.id }, 
      process.env.JWT_SECRET, 
      { expiresIn: "1h" }
    );

    const resetLink = `https://tucampus.vercel.app/reset-password.html?token=${resetToken}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "TuCampus - Recuperación de contraseña",
      html: `<h2>Recuperación de contraseña</h2>
             <p>Haz clic en el siguiente enlace para crear una nueva contraseña. Este enlace expira en exactamente 1 hora.</p>
             <br>
             <a href="${resetLink}" style="padding: 10px 20px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 5px;">Restablecer mi contraseña</a>`,
    });

    res.json({ message: "Correo enviado si existe la cuenta." });
  } catch (error) {
    console.error("Error enviando correo de recuperación:", error);
    res.status(500).json({ message: "Error procesando la solicitud." });
  }
};

// API: Restablecer contraseña (Valida token y actualiza)
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    // Ahora sí, esto funcionará porque el token que enviamos al correo ES un JWT válido
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Hasheamos la nueva contraseña y actualizamos usando el ID que venía oculto en el token
    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updatePassword(decoded.id, hashed);

    res.json({ message: "Contraseña restablecida correctamente" });
  } catch (error) {
    console.error("Error al resetear contraseña:", error.message);
    res.status(400).json({ error: "Token inválido o expirado" });
  }
};

module.exports = {
  register,
  login,
  logout,
  getPublicKeyEndpoint,
  uploadSecureFile,
  getProfile,
  forgotPassword,
  changePassword,
  resetPassword,
};
