const db = require("../../../config/dbSql");

const User = {
  // Buscar usuario por ID (NECESARIO PARA EL PERFIL)
  findById: async (id) => {
    try {
      const [rows] = await db.execute(
        "SELECT id, nombre, email, password, matricula, rol, vendedor_verificado FROM users WHERE id = ?",
        [id],
      );
      return rows[0];
    } catch (error) {
      console.error("Error en User.findById:", error.message);
      throw error;
    }
  },

  // Buscar usuario por email (Para el Login)
  findByEmail: async (email) => {
    try {
      const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [
        email,
      ]);
      return rows[0];
    } catch (error) {
      console.error("Error en findByEmail:", error.message);
      throw error;
    }
  },

  // Crear nuevo usuario (Rol por defecto 'Al')
  create: async ({ nombre, email, password, matricula }) => {
    try {
      const [result] = await db.execute(
        "INSERT INTO users (nombre, email, password, matricula, rol) VALUES (?, ?, ?, ?, 'Al')",
        [nombre, email, password, matricula],
      );
      return result.insertId;
    } catch (error) {
      console.error("Error en User.create:", error.message);
      throw error;
    }
  },

  // Obtener archivos del usuario (Mantiene fecha_subida)
  getUserFiles: async (userId) => {
    try {
      const [rows] = await db.execute(
        "SELECT url_archivo FROM user_files WHERE user_id = ? ORDER BY fecha_subida DESC",
        [userId],
      );
      return rows;
    } catch (error) {
      console.error("Error en getUserFiles:", error.message);
      throw error;
    }
  },

  // Registrar el hash del archivo
  registerFileHash: async (userId, nombre, url, hash) => {
    try {
      await db.execute(
        "INSERT INTO user_files (user_id, nombre_archivo, url_archivo, file_hash) VALUES (?, ?, ?, ?)",
        [userId, nombre, url, hash],
      );
    } catch (error) {
      console.error("Error en registerFileHash:", error.message);
      throw error;
    }
  },

  // Manejo de sesiones (Sincronizado con tabla sessions)
  createSession: async (userId, token, expiresAt) => {
    try {
      await db.execute(
        "INSERT INTO sessions (user_id, token, expira_en) VALUES (?, ?, ?)",
        [userId, token, expiresAt],
      );
    } catch (error) {
      console.error("Error en createSession:", error.message);
      throw error;
    }
  },

  deleteSession: async (token) => {
    try {
      await db.execute("DELETE FROM sessions WHERE token = ?", [token]);
    } catch (error) {
      console.error("Error en deleteSession:", error.message);
      throw error;
    }
  },
};

module.exports = User;
