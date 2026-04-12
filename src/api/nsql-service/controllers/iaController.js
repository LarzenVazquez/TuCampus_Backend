const brain = require("brain.js");
const Recommendation = require("../models/IaModel");
const Product = require("../models/productModel");

const net = new brain.NeuralNetwork({ hiddenLayers: [4, 4] });

const getMexicoHour = () => {
  const str = new Date().toLocaleString("en-US", {
    timeZone: "America/Mexico_City",
  });
  return new Date(str).getHours();
};

const iaController = {
  train: async (req, res) => {
    try {
      const productosDB = await Product.find({ estado: "DISPONIBLE" });
      const horaActual = getMexicoHour();

      if (productosDB.length === 0) {
        return res
          .status(404)
          .json({ error: "No hay productos disponibles para entrenar" });
      }

      const trainingData = productosDB.map((p) => ({
        input: {
          precio: p.precio / 100,
          stock: p.stock > 0 ? 1 : 0,
          horario: horaActual / 24,
        },
        output: { relevancia: p.stock > 0 ? 1 : 0 },
      }));
      net.train(trainingData, { iterations: 2000, log: false });

      const resultados = [];
      for (const p of productosDB) {
        const output = net.run({
          precio: p.precio / 100,
          stock: p.stock > 0 ? 1 : 0,
          horario: horaActual / 24,
        });

        const score = output.relevancia;

        // Solo guardamos si la IA considera que es medianamente relevante
        if (score > 0.4) {
          await Recommendation.findOneAndUpdate(
            { producto_base_id: p._id, hora_prediccion: horaActual },
            {
              nombre_producto: p.nombre,
              precio: p.precio,
              categoria: p.categoria || "General",
              imagenUrl: p.imagenUrl,
              score_relevancia: score,
              ultima_actualizacion: new Date(),
            },
            { upsert: true },
          );
          resultados.push({
            producto: p.nombre,
            score: (score * 100).toFixed(0) + "%",
          });
        }
      }

      res.json({
        status: "success",
        message: "La Neurona ha sido actualizada",
        hora_entrenamiento: horaActual,
        items_procesados: resultados.length,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  getStatus: async (req, res) => {
    try {
      const stats = await Recommendation.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            ultimaActualizacion: { $max: "$ultima_actualizacion" },
            promedioRelevancia: { $avg: "$score_relevancia" },
          },
        },
      ]);

      res.json({
        estado: "Operativo",
        modelo: "FeedForward Neural Network (brain.js)",
        datos: stats[0] || { total: 0, ultimaActualizacion: "Sin datos" },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  reset: async (req, res) => {
    try {
      await Recommendation.deleteMany({});
      res.json({ status: "success", message: "Memoria de la IA limpiada" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  predict: async (req, res) => {
    try {
      const horaActual = getMexicoHour();
      const sugerencias = await Recommendation.find({
        hora_prediccion: horaActual,
      })
        .sort({ score_relevancia: -1 })
        .limit(6);

      res.json({
        tipo: "Tendencias de la hora",
        sugerencias,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  ask: async (req, res) => {
    try {
      const { prompt } = req.query;
      if (!prompt) return res.status(400).json({ error: "Escribe tu antojo" });

      const horaActual = getMexicoHour();

      const numMatch = prompt.match(/\d+/);
      const presupuesto = numMatch ? parseInt(numMatch[0]) : 999;

      let tags = [];
      const p = prompt.toLowerCase();
      if (/dulce|postre|antojo|chocolate|azucar/i.test(p))
        tags.push("Postre", "Dulce");
      if (/bebida|tomar|sed|cafe|frio|caliente/i.test(p))
        tags.push("Bebida", "Café", "Refresco");
      if (/hambre|comida|salado|torta|lunch/i.test(p))
        tags.push("Comida", "Salado", "Torta");

      let query = {
        hora_prediccion: horaActual,
        precio: { $lte: presupuesto },
      };

      if (tags.length > 0) {
        query.categoria = { $in: tags.map((t) => new RegExp(t, "i")) };
      }

      const resultados = await Recommendation.find(query)
        .sort({ score_relevancia: -1 })
        .limit(4);

      res.json({
        tipo: "Análisis de la Neurona",
        contexto: { presupuesto, categorias: tags },
        sugerencias: resultados,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  registerFeedback: async (req, res) => {
    try {
      const { id, accion } = req.body;
      const update =
        accion === "venta"
          ? { $inc: { ventas_vinculadas: 1 } }
          : { $inc: { clics_interaccion: 1 } };

      await Recommendation.findByIdAndUpdate(id, update);
      res.json({ status: "success" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = iaController;
