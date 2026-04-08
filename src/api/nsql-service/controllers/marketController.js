const Market = require("../models/marketModel");

const marketController = {
  publishItem: async (req, res) => {
    try {
      const { titulo, precio, descripcion, categoria, imagenes } = req.body;

      const nuevoItem = new Market({
        vendedorId: req.user.id,
        nombreVendedor: req.user.nombre,
        titulo,
        precio,
        descripcion,
        categoria,
        imagenes:
          imagenes && imagenes.length > 0
            ? imagenes
            : ["https://images.unsplash.com/photo-1526304640581-d334cdbbf45e"],
        estatus: "pendiente",
      });

      await nuevoItem.save();
      res.status(201).json({
        message: "Producto enviado a revisión. Estará visible pronto.",
        item: nuevoItem,
      });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Error al publicar", error: error.message });
    }
  },

  getMarketItems: async (req, res) => {
    try {
      const items = await Market.find({ estatus: "activo" }).sort({
        fechaPublicacion: -1,
      });
      res.json(items);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error al obtener productos", error: error.message });
    }
  },

  updateItem: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const item = await Market.findOneAndUpdate(
        { _id: id, vendedorId: req.user.id },
        { ...updates, estatus: "pendiente" },
        { new: true },
      );

      if (!item)
        return res
          .status(404)
          .json({ message: "Producto no encontrado o no tienes permiso" });

      res.json({ message: "Producto actualizado y enviado a revisión", item });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Error al actualizar", error: error.message });
    }
  },

  deleteItem: async (req, res) => {
    try {
      const { id } = req.params;

      const query =
        req.user.role === "admin"
          ? { _id: id }
          : { _id: id, vendedorId: req.user.id };

      const item = await Market.findOneAndDelete(query);

      if (!item)
        return res
          .status(404)
          .json({ message: "No se pudo eliminar el producto" });

      res.json({ message: "Producto eliminado correctamente" });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Error al eliminar", error: error.message });
    }
  },

  moderateItem: async (req, res) => {
    try {
      const { id } = req.params;
      const { estatus, motivoRechazo } = req.body;

      const item = await Market.findByIdAndUpdate(
        id,
        { estatus, motivoRechazo },
        { new: true },
      );

      if (!item)
        return res.status(404).json({ message: "Producto no encontrado" });

      res.json({
        message: `Estatus cambiado a ${estatus} correctamente`,
        item,
      });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Error en la moderación", error: error.message });
    }
  },

  getMyItems: async (req, res) => {
    try {
      const items = await Market.find({ vendedorId: req.user.id });
      res.json(items);
    } catch (error) {
      res.status(500).json({
        message: "Error al obtener tus anuncios",
        error: error.message,
      });
    }
  },
};

module.exports = marketController;
