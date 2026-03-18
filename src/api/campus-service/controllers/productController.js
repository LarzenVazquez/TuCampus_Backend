const Product = require("../models/productModel");

const productController = {
  getProducts: async (req, res) => {
    try {
      const productos = await Product.find({ tipo: "Cafeteria" });
      res.status(200).json(productos);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error al cargar el menú", error: error.message });
    }
  },

  // Obtener por categoría
  getProductsByCategory: async (req, res) => {
    try {
      const { cat } = req.params;
      const productos = await Product.find({
        categoria: cat,
        tipo: "Cafeteria",
      });
      res.status(200).json(productos);
    } catch (error) {
      res.status(500).json({ message: "Error al filtrar productos" });
    }
  },

  createProduct: async (req, res) => {
    try {
      const nuevoProducto = new Product(req.body);
      await nuevoProducto.save();
      res
        .status(201)
        .json({ message: "Producto registrado", product: nuevoProducto });
    } catch (error) {
      res
        .status(400)
        .json({ message: "Error al crear producto", error: error.message });
    }
  },

  // Eliminar producto
  deleteProduct: async (req, res) => {
    try {
      await Product.findByIdAndDelete(req.params.id);
      res.status(200).json({ message: "Producto eliminado" });
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar" });
    }
  },
};

module.exports = productController;
