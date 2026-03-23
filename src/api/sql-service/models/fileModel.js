const db = require("../../../config/dbSql");

/* Registro del archivo y su hash en la DB */
const FileModel = {
  /* registro con SHA-256 */
  registerFile: async (userId, fileName, filePath, fileHash, type) => {
    try {
      /* insertar registro en user_files */
      const [result] = await db.execute(
        "INSERT INTO user_files (user_id, nombre_archivo, url_archivo, file_hash, tipo_archivo) VALUES (?, ?, ?, ?, ?)",
        [userId, fileName, filePath, fileHash, type],
      );

      /* retornar el id insertado */
      return result.insertId;
    } catch (error) {
      /* error en el modelo */
      throw error;
    }
  },
};

module.exports = FileModel;
