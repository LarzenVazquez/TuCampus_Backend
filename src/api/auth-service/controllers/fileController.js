const crypto = require("crypto");
const fs = require("fs");
const FileModel = require("../models/fileModel");

/* Controlador para la gestión y validación de imágenes de perfil */
const uploadProfileImage = async (req, res) => {
  try {
    /* Verificación de existencia del archivo */
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "No se proporcionó ningún archivo" });
    }

    const file = req.file;
    const userId = req.user.id;

    /* Generación de identificador de integridad para el archivo */
    const fileBuffer = fs.readFileSync(file.path);
    const fileHash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    /* Registro de la información del archivo en la base de datos */
    await FileModel.registerFile(
      userId,
      file.filename,
      file.path,
      fileHash,
      "perfil",
    );

    res.status(200).json({
      status: "success",
      message: "Perfil actualizado correctamente",
    });
  } catch (error) {
    console.error("Error al subir la imagen:", error);
    res.status(500).json({ message: "Error al procesar la solicitud" });
  }
};

module.exports = { uploadProfileImage };
