const crypto = require("crypto");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const FileModel = require("../models/fileModel");

const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "No se proporcionó ningún archivo" });
    }

    const file = req.file;
    const userId = req.user.id;

    const fileBuffer = fs.readFileSync(file.path);
    const fileHash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    // Preparar para subir a ImgBB (Nube)
    const form = new FormData();
    form.append("image", fileBuffer.toString("base64"));

    const IMGBB_KEY = process.env.IMGBB_API_KEY;

    const imgbbRes = await axios.post(
      `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
      },
    );

    const remoteUrl = imgbbRes.data.data.url;

    // Guardar en la BD usando los campos de tu nueva tabla user_files
    await FileModel.registerFile(
      userId,
      file.originalname,
      remoteUrl, // Guardamos la URL remota, no el path local
      fileHash,
      "perfil",
    );

    // Borrar archivo temporal del servidor
    fs.unlinkSync(file.path);

    res.status(200).json({
      status: "success",
      message: "Perfil actualizado correctamente",
      url: remoteUrl,
    });
  } catch (error) {
    // Limpieza en caso de error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Error al subir la imagen:", error.message);
    res.status(500).json({ message: "Error al procesar la solicitud" });
  }
};

module.exports = { uploadProfileImage };
