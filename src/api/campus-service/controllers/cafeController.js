const Product = require("../models/productModel");
const {
  successResponse,
  errorResponse,
} = require("../../../utils/responseHandler");

const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ disponible: true });
    successResponse(res, products, "Productos obtenidos");
  } catch (error) {
    errorResponse(res, "Error al obtener productos: " + error.message);
  }
};

const createProduct = async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    const savedProduct = await newProduct.save();
    successResponse(res, savedProduct, "Producto creado con éxito", 201);
  } catch (error) {
    errorResponse(res, "Error al crear producto: " + error.message, 400);
  }
};

const getProductsByCategory = async (req, res) => {
  try {
    const { cat } = req.params;
    const products = await Product.find({ categoria: cat, disponible: true });
    successResponse(res, products, `Productos de la categoría ${cat}`);
  } catch (error) {
    errorResponse(res, error.message);
  }
};

const deleteProduct = async (req, res) => {
  try {
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
