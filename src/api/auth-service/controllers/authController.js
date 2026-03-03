const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  successResponse,
  errorResponse,
} = require("../../../utils/responseHandler");

const register = async (req, res) => {
  try {
    const { nombre, email, password, rol_id } = req.body;

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
      rol_id,
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

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return errorResponse(res, "Credenciales inválidas", 400);

    const token = jwt.sign(
      { id: user.id_usuario, rol: user.rol_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "24h" },
    );

    successResponse(
      res,
      {
        token,
        user: {
          id: user.id_usuario,
          nombre: user.nombre,
          email: user.email,
          rol: user.rol_id,
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
    await User.updateProfile(req.user.id, req.body);
    successResponse(res, null, "Perfil actualizado correctamente");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

module.exports = { register, login, updateProfile };
