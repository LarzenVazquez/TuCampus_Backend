const db = require("../../../config/dbSql");

/* Registro del archivo y su hash en la DB */
const FileModel = {
  /* registro con SHA-256 */
  registerFile: async (userId, fileName, filePath, fileHash, type) => {
    try {
      /* insertar registro en user_files - Coincide con la nueva BD */
      const [result] = await db.execute(
        "INSERT INTO user_files (user_id, nombre_archivo, url_archivo, file_hash, tipo_archivo) VALUES (?, ?, ?, ?, ?)",
        [userId, fileName, filePath, fileHash, type],
      );

      /* retornar el id insertado */
      return result.insertId;
    } catch (error) {
      /* error en el modelo */
      console.error("Error en FileModel.registerFile:", error.message);
      throw error;
    }
  },

  /* Obtener archivos de un usuario específico */
  getFilesByUserId: async (userId) => {
    try {
      const [rows] = await db.execute(
        "SELECT * FROM user_files WHERE user_id = ? ORDER BY fecha_subida DESC",
        [userId],
      );
      return rows;
    } catch (error) {
      console.error("Error en FileModel.getFilesByUserId:", error.message);
      throw error;
    }
  },
};

module.exports = FileModel;
