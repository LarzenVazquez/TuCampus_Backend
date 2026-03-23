const db = require("../../../config/dbSql");

const Admin = {
  // Listado maestro de usuarios
  getUsersWithStats: async () => {
    const [rows] = await db.execute(`
      SELECT id, nombre, email, matricula, rol, es_vendedor_verificado, created_at,
      (SELECT COUNT(*) FROM user_files WHERE user_id = users.id) as total_archivos
      FROM users
    `);
    return rows;
  },

  // Cambiar rol de usuario (Admin -> Vendedor -> Comprador)
  updateUserRole: async (userId, newRole) => {
    return await db.execute("UPDATE users SET rol = ? WHERE id = ?", [
      newRole,
      userId,
    ]);
  },
};

module.exports = Admin;
