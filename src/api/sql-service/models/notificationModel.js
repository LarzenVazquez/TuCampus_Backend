const db = require("../../../config/dbSql"); 

const Notification = {
  create: async (userId, mensaje) => {
    const sql = "INSERT INTO notificaciones (user_id, mensaje) VALUES (?, ?)";
    const [result] = await db.execute(sql, [userId, mensaje]);
    return result;
  },

  getByUserId: async (userId) => {
    const sql = "SELECT * FROM notificaciones WHERE user_id = ? ORDER BY fecha DESC LIMIT 20";
    const [rows] = await db.execute(sql, [userId]);
    return rows;
  },

  markAllAsRead: async (userId) => {
    const sql = "UPDATE notificaciones SET leida = 1 WHERE user_id = ?";
    const [result] = await db.execute(sql, [userId]);
    return result;
  }
};

module.exports = Notification;