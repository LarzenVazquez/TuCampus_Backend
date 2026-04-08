const db = require("../../../config/dbSql");

const Admin = {
  // Listado maestro de usuarios con la columna corregida
  getUsersWithStats: async () => {
    try {
      const [rows] = await db.execute(`
        SELECT 
          id, 
          nombre, 
          email, 
          matricula, 
          rol, 
          vendedor_verificado, 
          created_at,
          (SELECT COUNT(*) FROM user_files WHERE user_id = users.id) as total_archivos
        FROM users
        ORDER BY created_at DESC
      `);
      return rows;
    } catch (error) {
      console.error("Error en adminModel (getUsersWithStats):", error.message);
      throw error;
    }
  },

  // Cambiar rol de usuario con validación implícita de las nuevas siglas
  updateUserRole: async (userId, newRole) => {
    try {
      // Nota: newRole debe ser 'A', 'A_C', 'Al' o 'A_V'
      const [result] = await db.execute(
        "UPDATE users SET rol = ? WHERE id = ?",
        [newRole, userId],
      );
      return result;
    } catch (error) {
      console.error("Error en adminModel (updateUserRole):", error.message);
      throw error;
    }
  },

  // Función extra útil para la nueva lógica de verificación
  verifySellerStatus: async (userId, status) => {
    try {
      // status: 1 para verificado, 0 para no verificado
      const [result] = await db.execute(
        "UPDATE users SET vendedor_verificado = ? WHERE id = ?",
        [status ? 1 : 0, userId],
      );
      return result;
    } catch (error) {
      console.error("Error en adminModel (verifySellerStatus):", error.message);
      throw error;
    }
  },
};

module.exports = Admin;
