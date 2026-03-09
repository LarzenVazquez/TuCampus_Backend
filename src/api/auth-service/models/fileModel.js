const db = require("../../../config/dbSql");

const FileModel = {
  // Registrar el archivo y su hash en la DB
  registerFile: async (userId, fileName, filePath, fileHash, type) => {
    try {
      const [result] = await db.execute(
        "INSERT INTO user_files (user_id, nombre_archivo, url_archivo, file_hash, tipo_archivo) VALUES (?, ?, ?, ?, ?)",
        [userId, fileName, filePath, fileHash, type],
      );
      return result.insertId;
    } catch (error) {
      throw error;
    }
  },
};

module.exports = FileModel;
