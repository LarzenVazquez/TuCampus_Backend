const db = require("../../../config/dbSql");

const Session = {
  // Registrar inicio de sesión
  create: async (userId, token, expiresAt) => {
    try {
      return await db.execute(
        "INSERT INTO sessions (user_id, token, expira_en) VALUES (?, ?, ?)",
        [userId, token, expiresAt],
      );
    } catch (error) {
      console.error("Error en Session.create:", error.message);
      throw error;
    }
  },

  // Eliminar sesión (Logout manual)
  deleteByToken: async (token) => {
    try {
      return await db.execute("DELETE FROM sessions WHERE token = ?", [token]);
    } catch (error) {
      console.error("Error en Session.deleteByToken:", error.message);
      throw error;
    }
  },

  // Validar si el token existe en la BD y no ha expirado
  isValid: async (token) => {
    try {
      const [rows] = await db.execute(
        "SELECT * FROM sessions WHERE token = ? AND expira_en > NOW()",
        [token],
      );
      return rows.length > 0;
    } catch (error) {
      return false;
    }
  },

  // Limpiar sesiones expiradas (Mantenimiento)
  clearExpired: async () => {
    try {
      return await db.execute("DELETE FROM sessions WHERE expira_en < NOW()");
    } catch (error) {
      console.error("Error en Session.clearExpired:", error.message);
    }
  },
};

module.exports = Session;
