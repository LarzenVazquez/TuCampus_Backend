const Product = require("../models/productModel");

const productController = {
  // Obtiene solo productos de Cafetería
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

  // Obtiene productos por categoría (Filtrado para Cafetería)
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

  // Crea productos asignando el tipo según el rol del admin
  createProduct: async (req, res) => {
    try {
      // Determinamos el tipo basado en el rol del usuario que crea
      const tipoAsignado =
        req.user.rol === "admin-c" ? "Cafeteria" : "Marketplace";

      const nuevoProducto = new Product({
        ...req.body,
        tipo: tipoAsignado,
        vendedorId: req.user.id, // Importante para validar propiedad después
      });

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

  // Buscador inteligente (Filtra por Cafetería)
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

  // Actualización con permisos para ambos admin
  updateProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const producto = await Product.findById(id);

      if (!producto) return res.status(404).json({ message: "No existe" });

      // Lógica de permisos:
      // 1. El dueño puede editar
      // 2. Si es de cafetería, solo admin-c puede editar
      // 3. Si es marketplace, admin general puede editar
      const canEdit =
        producto.vendedorId === req.user.id ||
        (producto.tipo === "Cafeteria" && req.user.rol === "admin-c") ||
        (producto.tipo === "Marketplace" && req.user.rol === "admin");

      if (!canEdit) {
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

  // Eliminación con permisos para ambos admin
  deleteProduct: async (req, res) => {
    try {
      const producto = await Product.findById(req.params.id);
      if (!producto)
        return res.status(404).json({ message: "Producto no encontrado" });

      const canDelete =
        producto.vendedorId === req.user.id ||
        (producto.tipo === "Cafeteria" && req.user.rol === "admin-c") ||
        (producto.tipo === "Marketplace" && req.user.rol === "admin");

      if (!canDelete) {
        return res.status(403).json({
          message: "No puedes borrar lo que no es tuyo o no te corresponde",
        });
      }

      await Product.findByIdAndDelete(req.params.id);
      res.json({ message: "Eliminado correctamente" });
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar" });
    }
  },
};

module.exports = productController;
