const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const forge = require("node-forge");
const crypto = require("crypto");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const { decryptrsa, getpublickey } = require("../../../utils/cryptoHelper");

// Configuración de SendGrid
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/* Llave Pública RSA para el cliente */
const getPublicKeyEndpoint = (req, res) => {
  res.json({ publicKey: getpublickey() });
};

/* --- 1. REGISTRO CON DOBLE VERIFICACIÓN --- */
const register = async (req, res) => {
  try {
    const { nombre, email, password, matricula } = req.body;
    const existing = await User.findByEmail(email);
    if (existing)
      return res.status(400).json({ message: "Email ya registrado" });

    /* Encriptar contraseña con Bcrypt */
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Crear usuario en BD (Larzen: Asegúrate de tener email_verificado en 0 por defecto en MySQL)
    const userId = await User.create({
      nombre,
      email,
      password: hashedPassword,
      matricula,
      rol: "Al", // Se asegura el rol por defecto
      vendedor_verificado: 0, // Se asegura el estado inicial
    });

    // Generar token para el correo (expira en 24h)
    const verifyToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "24h" });
    const verifyLink = `https://tucampus.vercel.app/auth/verify-email.html?token=${verifyToken}`;

    // Enviar correo de bienvenida y verificación
    const msg = {
      to: email,
      from: 'tucampus.uteq@gmail.com', // El correo que validaron en SendGrid
      subject: "TuCampus - Verifica tu correo universitario",
      html: `<h2>¡Bienvenido a TuCampus!</h2>
             <p>Hola ${nombre}, estamos emocionados de tenerte aquí.</p>
             <p>Para poder iniciar sesión, necesitamos confirmar que este es tu correo institucional.</p>
             <br>
             <a href="${verifyLink}" style="padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Verificar mi cuenta</a>`
    };
    await sgMail.send(msg);

    res.status(201).json({
      status: "success",
      message: "Usuario registrado con éxito. Revisa tu correo.",
      userId,
    });
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({ message: "Error al registrar usuario" });
  }
};

/* --- 2. VALIDAR EL CORREO AL HACER CLIC EN EL ENLACE --- */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Token no proporcionado" });

    // Desencriptar token para saber qué correo es
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await User.verifyEmail(decoded.email); 

    res.json({ message: "¡Correo verificado exitosamente!" });
  } catch (error) {
    res.status(400).json({ error: "El enlace expiró o es inválido." });
  }
};

/* --- 3. LOGIN (CON BLOQUEO SI NO ESTÁ VERIFICADO) --- */
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
      return res.status(400).json({ message: "Error al descifrar la contraseña" });

    const passwordPlana = decipher.output.toString();

    /* Buscar usuario en la base de datos */
    const user = await User.findByEmail(email);
    if (!user)
      return res.status(401).json({ message: "Credenciales incorrectas" });

    /* Comparar contraseña plana contra el hash de la base de datos */
    const isMatch = await bcrypt.compare(passwordPlana, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Credenciales incorrectas" });

    /* !!! BLOQUEO DE DOBLE VERIFICACIÓN !!! */
    // Comprueba que Larzen haya agregado esta columna, de lo contrario esto siempre bloqueará
    if (user.email_verificado === 0 || user.email_verificado === false) {
      return res.status(403).json({ message: "Debes verificar tu correo institucional antes de iniciar sesión. Revisa tu bandeja de entrada." });
    }

    /* buscar si el usuario ya tiene una foto de perfil */
    const userFiles = await User.getUserFiles(user.id);
    const fotoUrl = userFiles.length > 0 ? userFiles[0].url_archivo : null;

    /* Crear token JWT para la sesión */
    const token = jwt.sign(
      { id: user.id, rol: user.rol, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      status: "success",
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        rol: user.rol,
        email: user.email,
        fotoUrl: fotoUrl,
        vendedor_verificado: user.vendedor_verificado,
      },
    });
  } catch (error) {
    console.error("Error en servidor:", error.message);
    res.status(500).json({ message: "Error al iniciar sesión" });
  }
};
changePassword: async (req, res) => {
    try {
      const { encryptedCurrentPassword, encryptedNewPassword, encryptedAesKey, iv } = req.body;
      const userId = req.user.id; // Viene del token

      // 1. Descifrar la llave AES (Larzen, esto es igualito a tu función de login)
      const privateKey = forge.pki.privateKeyFromPem(process.env.PRIVATE_KEY);
      const aesKeyHex = privateKey.decrypt(forge.util.decode64(encryptedAesKey));
      const aesKey = forge.util.hexToBytes(aesKeyHex);
      const ivBytes = forge.util.hexToBytes(iv);

      // 2. Descifrar contraseña actual
      const decipher1 = forge.cipher.createDecipher("AES-CBC", aesKey);
      decipher1.start({ iv: ivBytes });
      decipher1.update(forge.util.createBuffer(forge.util.decode64(encryptedCurrentPassword)));
      decipher1.finish();
      const currentPassword = decipher1.output.toString();

      // 3. Descifrar nueva contraseña
      const decipher2 = forge.cipher.createDecipher("AES-CBC", aesKey);
      decipher2.start({ iv: ivBytes });
      decipher2.update(forge.util.createBuffer(forge.util.decode64(encryptedNewPassword)));
      decipher2.finish();
      const newPassword = decipher2.output.toString();

      // 4. Buscar usuario en MySQL
      const [users] = await db.execute("SELECT * FROM users WHERE id = ?", [userId]);
      if (users.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });
      const user = users[0];

      // 5. Verificar que la contraseña actual sea correcta
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(400).json({ message: "La contraseña actual es incorrecta" });

      // 6. Hashear la nueva contraseña y guardarla
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await db.execute("UPDATE users SET password = ? WHERE id = ?", [hashedNewPassword, userId]);

      res.json({ message: "Contraseña actualizada exitosamente" });
    } catch (error) {
      console.error("Error al cambiar contraseña:", error);
      res.status(500).json({ message: "Error interno al actualizar la contraseña" });
    }
  }
  
const uploadSecureFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No se subió ningún archivo" });
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    console.log("Firma del archivo:", fileHash);

    const form = new FormData();
    form.append("image", fileBuffer.toString("base64"));
    const IMGBB_KEY = process.env.IMGBB_API_KEY;

    const imgbbRes = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, form, {
      headers: { ...form.getHeaders() },
    });
    const remoteUrl = imgbbRes.data.data.url;

    await User.registerFileHash(req.user.id, req.file.originalname, remoteUrl, fileHash);
    fs.unlinkSync(req.file.path);

    res.json({ status: "success", message: "Imagen subida y verificada", hash: fileHash, url: remoteUrl });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: "Error al subir la imagen" });
  }
};

const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) await User.deleteSession(token);
    res.json({ message: "Sesión cerrada" });
  } catch (error) {
    res.status(500).json({ message: "Error al cerrar sesión" });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    const userFiles = await User.getUserFiles(user.id);
    const fotoUrl = userFiles.length > 0 ? userFiles[0].url_archivo : null;

    res.json({
      nombre: user.nombre,
      email: user.email,
      rol: user.rol.trim(),
      fotoUrl: fotoUrl,
      vendedor_verificado: user.vendedor_verificado,
    });
  } catch (error) {
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
    if (!isMatch) return res.status(401).json({ error: "La contraseña actual es incorrecta" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updatePassword(userId, hashed);

    res.json({ message: "Contraseña actualizada con éxito" });
  } catch (error) {
    res.status(500).json({ error: "Error interno al cambiar contraseña" });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findByEmail(email);

    if (!user) return res.json({ message: "Correo enviado si existe la cuenta." });

    const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const resetLink = `https://tucampus.vercel.app/auth/reset-password.html?token=${resetToken}`;
    
    const msg = {
      to: email,
      from: 'tucampus.uteq@gmail.com',
      subject: "TuCampus - Recuperación de contraseña",
      html: `<h2>Recuperación de contraseña</h2>
             <p>Haz clic en el siguiente enlace para crear una nueva contraseña. Este enlace expira en exactamente 1 hora.</p>
             <br>
             <a href="${resetLink}" style="padding: 10px 20px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 5px;">Restablecer mi contraseña</a>`
    };
    await sgMail.send(msg);

    res.json({ message: "Correo enviado si existe la cuenta." });
  } catch (error) {
    res.status(500).json({ message: "Error procesando la solicitud." });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updatePassword(decoded.id, hashed);

    res.json({ message: "Contraseña restablecida correctamente" });
  } catch (error) {
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
  verifyEmail 
};