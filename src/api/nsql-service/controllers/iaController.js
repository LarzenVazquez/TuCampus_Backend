const brain = require("brain.js");
const iaModel = require("../models/iaModel");
const Product = require("../models/productModel");

const net = new brain.NeuralNetwork({ hiddenLayers: [4, 4] });

const iaController = {
  train: async (req, res) => {
    try {
      const productosDB = await Product.find({});
      const horaActual = new Date().getHours();

      // 1. Preparar datos de entrenamiento
      const trainingData = productosDB.map((p) => ({
        input: {
          precio: p.precio / 100,
          stock: p.stock > 0 ? 1 : 0,
          estado: p.estado === "DISPONIBLE" ? 1 : 0,
          horario: horaActual / 24,
        },
        output: {
          relevancia: p.estado === "DISPONIBLE" && p.stock > 0 ? 1 : 0,
        },
      }));

      net.train(trainingData, { iterations: 2000, log: false });

      const resultados = [];

      for (const p of productosDB) {
        const output = net.run({
          precio: p.precio / 100,
          stock: p.stock > 0 ? 1 : 0,
          estado: p.estado === "DISPONIBLE" ? 1 : 0,
          horario: horaActual / 24,
        });

        const score = output.relevancia;

        if (score > 0.5) {
          await Recommendation.findOneAndUpdate(
            { producto_base_id: p._id },
            {
              nombre_producto: p.nombre,
              score_relevancia: score,
              ultima_actualizacion: new Date(),
            },
            { upsert: true },
          );

          resultados.push({
            nombre: p.nombre,
            score: (score * 100).toFixed(2) + "%",
            valor_numerico: score,
          });
        }
      }

      resultados.sort((a, b) => b.valor_numerico - a.valor_numerico);

      res.json({
        status: "success",
        message: "Neurona entrenada y ranking actualizado",
        ranking: resultados.map((r) => ({ nombre: r.nombre, score: r.score })),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  predict: async (req, res) => {
    try {
      const topOpciones = await Recommendation.find({})
        .sort({ score_relevancia: -1 })
        .limit(5);

      if (topOpciones.length === 0) {
        return res.json({ message: "No hay productos viables hoy" });
      }

      res.json({
        tipo: "Compra Rápida",
        timestamp: new Date().toLocaleTimeString(),
        sugerencias: topOpciones.map((r) => ({
          producto: r.nombre_producto,
          match: (r.score_relevancia * 100).toFixed(0) + "%",
        })),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = iaController;
