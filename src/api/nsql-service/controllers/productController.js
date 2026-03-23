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

  deleteProduct: async (req, res) => {
    try {
      await Product.findByIdAndDelete(req.params.id);
      res.status(200).json({ message: "Producto eliminado" });
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar" });
    }
  },

  searchProducts: async (req, res) => {
    try {
      const { q } = req.query;
      const productos = await Product.find({
        tipo: "Cafeteria",
        $or: [
          { nombre: { $regex: q, $options: "i" } },
          { descripcion: { $regex: q, $options: "i" } },
        ],
      });
      res.status(200).json(productos);
    } catch (error) {
      res.status(500).json({ message: "Error en la búsqueda" });
    }
  },
  getProductById: async (req, res) => {
    try {
      const producto = await Product.findById(req.params.id);
      if (!producto)
        return res.status(404).json({ message: "Producto no encontrado" });
      res.json(producto);
    } catch (error) {
      res.status(500).json({ message: "Error al buscar producto" });
    }
  },

  updateProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const producto = await Product.findById(id);

      if (!producto) return res.status(404).json({ message: "No existe" });

      if (producto.vendedorId !== req.user.id && req.user.rol !== "admin") {
        return res
          .status(403)
          .json({ message: "No tienes permiso para editar esto" });
      }

      const actualizado = await Product.findByIdAndUpdate(id, req.body, {
        new: true,
      });
      res.json({ message: "Actualizado con éxito", product: actualizado });
    } catch (error) {
      res.status(400).json({ message: "Error al actualizar" });
    }
  },

  deleteProduct: async (req, res) => {
    try {
      const producto = await Product.findById(req.params.id);
      if (producto.vendedorId !== req.user.id && req.user.rol !== "admin") {
        return res
          .status(403)
          .json({ message: "No puedes borrar lo que no es tuyo" });
      }
      await Product.findByIdAndDelete(req.params.id);
      res.json({ message: "Eliminado correctamente" });
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar" });
    }
  },
};

module.exports = productController;
