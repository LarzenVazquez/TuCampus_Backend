const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  successResponse,
  errorResponse,
} = require("../../../utils/responseHandler");

const register = async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body; // Cambiado rol_id -> rol

    if (!nombre || !email || !password) {
      return errorResponse(res, "Todos los campos son obligatorios", 400);
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return errorResponse(res, "El correo ya está registrado", 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userId = await User.create({
      nombre,
      email,
      password: hashedPassword,
      rol, // 'admin', 'staff', 'comprador', 'vendedor'
    });

    successResponse(res, { userId }, "Usuario registrado con éxito", 201);
  } catch (error) {
    errorResponse(res, "Error en el servidor: " + error.message);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) return errorResponse(res, "Credenciales inválidas", 400);

    // Cambiado: user.password -> user.password_hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return errorResponse(res, "Credenciales inválidas", 400);

    // Cambiado: id_usuario -> id y rol_id -> rol
    const token = jwt.sign(
      { id: user.id, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "24h" },
    );

    successResponse(
      res,
      {
        token,
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          rol: user.rol,
        },
      },
      "Login exitoso",
    );
  } catch (error) {
    errorResponse(res, "Error en el servidor: " + error.message);
  }
};

const updateProfile = async (req, res) => {
  try {
    // Cambiado: req.user.id_usuario -> req.user.id
    await User.updateProfile(req.user.id, req.body);
    successResponse(res, null, "Perfil actualizado correctamente");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

/* // En authController.js
static async forgotPassword(req, res) {
  const { email } = req.body;
  const user = await User.findByEmail(email);

  if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });

  // Generar token aleatorio
  const token = crypto.randomBytes(20).toString("hex");
  const expires = new Date(Date.now() + 3600000); // 1 hora de validez

  // Guardar token en MySQL (Necesitas crear este método en tu Model User)
  await User.setResetToken(user.id, token, expires);

  // Enviar el correo
  await EmailService.sendPasswordReset(email, token);

  res.json({ msg: "Correo de recuperación enviado" });
} */

module.exports = { register, login, updateProfile };
