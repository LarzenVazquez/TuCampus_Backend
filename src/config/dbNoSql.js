const mongoose = require("mongoose");
require("dotenv").config();

const connectNoSql = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    return conn;
  } catch (error) {
    throw new Error(`Error en MongoDB: ${error.message}`);
  }
};

module.exports = connectNoSql;
