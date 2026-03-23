const db = require("../../../config/dbSql");

const Session = {
  // Registrar inicio de sesión
  create: async (userId, token, expiresAt) => {
    return await db.execute(
      "INSERT INTO sessions (user_id, token, expira_en) VALUES (?, ?, ?)",
      [userId, token, expiresAt],
    );
  },

  // Eliminar sesión (Logout manual)
  deleteByToken: async (token) => {
    return await db.execute("DELETE FROM sessions WHERE token = ?", [token]);
  },

  // Limpiar sesiones expiradas (Mantenimiento)
  clearExpired: async () => {
    return await db.execute("DELETE FROM sessions WHERE expira_en < NOW()");
  },
};

module.exports = Session;
