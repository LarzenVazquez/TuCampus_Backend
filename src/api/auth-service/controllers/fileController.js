const crypto = require("crypto");
const fs = require("fs");
const FileModel = require("../models/fileModel");

const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "No se proporcionó ningún archivo" });
    }

    const file = req.file;
    const userId = req.user.id; // Obtenido del token por el middleware

    // --- REQUISITO C: INTEGRIDAD CON HASH SHA-256 ---
    // Leemos el buffer del archivo subido
    const fileBuffer = fs.readFileSync(file.path);
    // Generamos el hash único
    const fileHash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    // --- MVC: Llamada al Modelo ---
    await FileModel.registerFile(
      userId,
      file.filename,
      file.path,
      fileHash,
      "perfil",
    );

    res.status(200).json({
      status: "success",
      message: "Archivo verificado y registrado",
      hash: fileHash, // Se envía al front para que el alumno vea la evidencia
    });
  } catch (error) {
    console.error("Error en uploadProfileImage:", error);
    res.status(500).json({ message: "Error interno al procesar el archivo" });
  }
};

module.exports = { uploadProfileImage };
