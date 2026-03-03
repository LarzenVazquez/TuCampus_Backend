const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  // 1. Obtener el token del header (Authorization: Bearer <token>)
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ error: "Acceso denegado: No se proporcionó un token" });
  }

  try {
    // 2. Verificar el token con la llave secreta del .env
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Inyectar los datos del usuario en la petición (req.user)
    req.user = decoded;

    // 4. Continuar al siguiente paso (Controlador)
    next();
  } catch (error) {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
};

// Middleware opcional para roles (ej: solo Admins pueden crear productos)
const isAdmin = (req, res, next) => {
  if (req.user && req.user.rol === 1) {
    // Asumiendo que 1 es Admin en tu MySQL
    next();
  } else {
    res
      .status(403)
      .json({ error: "Permisos insuficientes: Se requiere rol de Admin" });
  }
};

module.exports = { verifyToken, isAdmin };
