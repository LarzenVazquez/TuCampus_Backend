const Product = require("../api/nsql-service/models/productModel");

const checkStock = async (req, res, next) => {
  try {
    const { items } = req.body;

    for (const item of items) {
      const producto = await Product.findById(item.productId);

      if (!producto) {
        return res
          .status(404)
          .json({ message: `El producto ${item.nombre} ya no existe.` });
      }

      if (producto.stock < item.cantidad) {
        return res.status(400).json({
          message: `Stock insuficiente para ${producto.nombre}. Disponibles: ${producto.stock}`,
        });
      }
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Error al validar stock" });
  }
};

module.exports = { checkStock };
