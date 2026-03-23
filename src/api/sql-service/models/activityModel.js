const db = require("../../../config/dbSql");

const Activity = {
  create: async (userId, accion, descripcion, ip) => {
    try {
      const [result] = await db.execute(
        "INSERT INTO activity_logs (user_id, accion, descripcion, ip_address) VALUES (?, ?, ?, ?)",
        [userId, accion, descripcion, ip],
      );
      return result.insertId;
    } catch (error) {
      console.error("Error al registrar actividad SQL:", error);
    }
  },

  getAll: async () => {
    const [rows] = await db.execute(
      `SELECT a.*, u.nombre as usuario_nombre, u.email 
       FROM activity_logs a 
       LEFT JOIN users u ON a.user_id = u.id 
       ORDER BY a.fecha DESC LIMIT 100`,
    );
    return rows;
  },
};

module.exports = Activity;
