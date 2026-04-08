const Product = require("../models/productModel");

const marketController = {
  publishItem: async (req, res) => {
    try {
      const { nombre, precio, descripcion, categoria, imagenUrl } = req.body;
      const nuevoItem = new Product({
        nombre,
        precio,
        descripcion,
        categoria,
        tipo: "Marketplace",
        imagenUrl:
          imagenUrl ||
          "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e",
        vendedorId: req.user.id,
        vendedorNombre: req.user.nombre,
      });
      await nuevoItem.save();
      res.status(201).json({
        message: "Producto publicado en el Marketplace",
        item: nuevoItem,
      });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Error al publicar", error: error.message });
    }
  },

  getMarketItems: async (req, res) => {
    const items = await Product.find({ tipo: "Marketplace" }).sort({
      createdAt: -1,
    });
    res.json(items);
  },
};

module.exports = marketController;
