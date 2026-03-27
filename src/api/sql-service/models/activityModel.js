const db = require("../../../config/dbSql");

const Activity = {
  create: async (userId, accion, descripcion, ip) => {
    try {
      // Los nombres de columnas coinciden con tu nueva tabla activity_logs
      const [result] = await db.execute(
        "INSERT INTO activity_logs (user_id, accion, descripcion, ip_address) VALUES (?, ?, ?, ?)",
        [userId, accion, descripcion, ip],
      );
      return result.insertId;
    } catch (error) {
      // Importante: No dejar que un error en el log detenga la ejecución principal
      console.error("Error al registrar actividad SQL:", error.message);
      return null;
    }
  },

  getAll: async () => {
    try {
      // Traemos el nombre y email del usuario para que el Admin vea quién hizo qué
      const [rows] = await db.execute(
        `SELECT a.*, u.nombre as usuario_nombre, u.email 
         FROM activity_logs a 
         LEFT JOIN users u ON a.user_id = u.id 
         ORDER BY a.fecha DESC LIMIT 100`,
      );
      return rows;
    } catch (error) {
      console.error("Error al obtener logs:", error.message);
      throw error;
    }
  },
};

module.exports = Activity;
