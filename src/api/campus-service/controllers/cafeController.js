const Product = require("../models/productModel");
const {
  successResponse,
  errorResponse,
} = require("../../../utils/responseHandler");

const getProducts = async (req, res) => {
  try {
    // Solo productos que no han sido "borrados" lógicamente
    const products = await Product.find({ disponible: true });
    successResponse(res, products, "Productos obtenidos");
  } catch (error) {
    errorResponse(res, "Error al obtener productos: " + error.message);
  }
};

const createProduct = async (req, res) => {
  try {
    // IMPORTANTE: Vinculamos el producto con el ID de MySQL que viene en el token
    const productData = {
      ...req.body,
      vendedor_id: req.user.id, // Usamos el 'id' de tu tabla 'users'
    };

    const newProduct = new Product(productData);
    const savedProduct = await newProduct.save();
    successResponse(res, savedProduct, "Producto creado con éxito", 201);
  } catch (error) {
    errorResponse(res, "Error al crear producto: " + error.message, 400);
  }
};

const getProductsByCategory = async (req, res) => {
  try {
    const { cat } = req.params; // 'cafeteria' o 'marketplace'
    const products = await Product.find({ categoria: cat, disponible: true });
    successResponse(res, products, `Productos de la categoría ${cat}`);
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const deleteProduct = async (req, res) => {
  try {
    // Borrado lógico para no perder integridad en órdenes pasadas
    await Product.findByIdAndUpdate(req.params.id, { disponible: false });
    successResponse(res, null, "Producto eliminado del menú");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

module.exports = {
  getProducts,
  createProduct,
  getProductsByCategory,
  deleteProduct,
};
