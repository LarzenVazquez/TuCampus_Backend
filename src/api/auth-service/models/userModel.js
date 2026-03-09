const db = require("../../../config/dbSql");

const User = {
  // Buscar por email para Login/Registro
  findByEmail: async (email) => {
    const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    return rows[0];
  },

  // Registro de usuario con password ya hasheado (Punto A)
  create: async (userData) => {
    const { nombre, email, password, matricula, rol } = userData;
    const [result] = await db.execute(
      "INSERT INTO users (nombre, email, password, matricula, rol) VALUES (?, ?, ?, ?, ?)",
      [nombre, email, password, matricula, rol || "comprador"],
    );
    return result.insertId;
  },

  // Manejo de Sesiones (Seguridad de estado)
  createSession: async (userId, token, expiresAt) => {
    await db.execute(
      "INSERT INTO sessions (user_id, token, expira_en) VALUES (?, ?, ?)",
      [userId, token, expiresAt],
    );
  },

  deleteSession: async (token) => {
    await db.execute("DELETE FROM sessions WHERE token = ?", [token]);
  },

  // Registro de Hash para integridad de archivos (Punto C)
  registerFileHash: async (userId, fileName, path, hash) => {
    return await db.execute(
      "INSERT INTO user_files (user_id, nombre_archivo, url_archivo, file_hash, tipo_archivo) VALUES (?, ?, ?, ?, ?)",
      [userId, fileName, path, hash, "perfil"],
    );
  },
};

module.exports = User;
