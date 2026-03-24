const db = require("../../../config/dbSql");

const User = {
  // Buscar usuario por email
  findByEmail: async (email) => {
    const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    return rows[0];
  },

  // Crear nuevo usuario
  create: async ({ nombre, email, password, matricula }) => {
    const [result] = await db.execute(
      "INSERT INTO users (nombre, email, password, matricula, rol) VALUES (?, ?, ?, ?, 'comprador')",
      [nombre, email, password, matricula],
    );
    return result.insertId;
  },

  // Obtener archivos del usuario (CORREGIDO: fecha_subida en lugar de created_at)
  getUserFiles: async (userId) => {
    const [rows] = await db.execute(
      "SELECT url_archivo FROM user_files WHERE user_id = ? ORDER BY fecha_subida DESC",
      [userId],
    );
    return rows;
  },

  // Registrar el hash del archivo
  registerFileHash: async (userId, nombre, url, hash) => {
    await db.execute(
      "INSERT INTO user_files (user_id, nombre_archivo, url_archivo, file_hash) VALUES (?, ?, ?, ?)",
      [userId, nombre, url, hash],
    );
  },

  // Manejo de sesiones (CORREGIDO: coincide con tu tabla sessions)
  createSession: async (userId, token, expiresAt) => {
    await db.execute(
      "INSERT INTO sessions (user_id, token, expira_en) VALUES (?, ?, ?)",
      [userId, token, expiresAt],
    );
  },

  deleteSession: async (token) => {
    await db.execute("DELETE FROM sessions WHERE token = ?", [token]);
  },
};

module.exports = User;
