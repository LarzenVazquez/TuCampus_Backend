const successResponse = (res, data, message = "Operación exitosa") => {
  res.status(200).json({ status: "success", message, data });
};

const errorResponse = (res, error, code = 500) => {
  res.status(code).json({ status: "error", error: error.message || error });
};

module.exports = { successResponse, errorResponse };
