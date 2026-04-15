const brain = require("brain.js");
const Recommendation = require("../models/IaModel");
const Product = require("../models/productModel");

let net = new brain.NeuralNetwork({ hiddenLayers: [6, 6] });

const getMexicoHour = () => {
  const str = new Date().toLocaleString("en-US", {
    timeZone: "America/Mexico_City",
  });
  return new Date(str).getHours();
};

const iaController = {
  train: async (req, res) => {
    try {
      const horaActual = getMexicoHour();

      const productosDB = await Product.find({
        estado: "DISPONIBLE",
      });

      if (productosDB.length === 0) {
        const errorMsg = "IA: No hay productos disponibles para entrenar.";
        if (res) return res.status(404).json({ error: errorMsg });
        return;
      }

      const trainingData = productosDB.map((p) => ({
        input: {
          precio: (p.precio || 0) / 1000,
          stock: (p.stock || 0) > 0 ? 1 : 0,
          horario: horaActual / 24,
          esCafeteria: p.tipo === "Cafeteria" ? 1 : 0,
          ligero: (p.calorias || 0) < 300 ? 1 : 0,
        },
        output: { relevancia: (p.stock || 0) > 2 ? 1 : 0.4 },
      }));

      net.train(trainingData, { iterations: 2000 });

      const bulkOps = productosDB.map((p) => {
        const output = net.run({
          precio: (p.precio || 0) / 1000,
          stock: (p.stock || 0) > 0 ? 1 : 0,
          horario: horaActual / 24,
          esCafeteria: p.tipo === "Cafeteria" ? 1 : 0,
          ligero: (p.calorias || 0) < 300 ? 1 : 0,
        });

        return {
          updateOne: {
            filter: { producto_base_id: p._id, hora_prediccion: horaActual },
            update: {
              nombre_producto: p.nombre,
              precio: p.precio,
              categoria: p.categoria || "General",
              imagenUrl: p.imagenUrl,
              tipo: p.tipo || "Cafeteria",
              calorias: p.calorias || 0,
              score_relevancia: output.relevancia,
              ultima_actualizacion: new Date(),
            },
            upsert: true,
          },
        };
      });

      await Recommendation.bulkWrite(bulkOps);

      if (res) {
        return res.json({
          status: "success",
          items: productosDB.length,
          hora: horaActual,
        });
      }
    } catch (err) {
      console.error("IA Train Error:", err.message);
      if (res) return res.status(500).json({ error: err.message });
    }
  },

  ask: async (req, res) => {
    try {
      const { prompt } = req.query;
      if (!prompt)
        return res.status(400).json({ error: "No se recibió un antojo." });

      const horaActual = getMexicoHour();
      const numMatch = prompt.match(/\d+/);
      const presupuesto = numMatch ? parseInt(numMatch[0]) : 999;

      let tags = [];
      const p = prompt.toLowerCase();

      if (/dulce|postre|antojo|chocolate|azucar|galleta|donas/i.test(p))
        tags.push("Postre", "Dulce");
      if (/bebida|tomar|sed|cafe|frio|caliente|agua|jugo|refresco/i.test(p))
        tags.push("Bebida", "Café", "Refresco");
      if (
        /hambre|comida|salado|torta|lunch|sandwich|lonche|hamburguesa/i.test(p)
      )
        tags.push("Comida", "Salado", "Torta");

      let query = {
        hora_prediccion: horaActual,
        precio: { $lte: presupuesto },
      };

      if (/ligero|sano|dieta|saludable|pocas calorias/i.test(p)) {
        query.calorias = { $lte: 350, $gt: 0 };
      }

      if (tags.length > 0) {
        query.categoria = { $in: tags.map((t) => new RegExp(t, "i")) };
      }

      const sugerencias = await Recommendation.find(query)
        .sort({ score_relevancia: -1 })
        .limit(4);

      res.json({ sugerencias });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  results: async (req, res) => {
    try {
      const horaActual = getMexicoHour();
      const sugerencias = await Recommendation.find({
        hora_prediccion: horaActual,
        tipo: "Cafeteria",
      })
        .sort({ score_relevancia: -1 })
        .limit(6);

      res.json({ tipo: "Tendencias de la hora", sugerencias });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  reset: async (req, res) => {
    try {
      await Recommendation.deleteMany({});
      net = new brain.NeuralNetwork({ hiddenLayers: [6, 6] });
      res.json({ status: "success", message: "Memoria de IA reiniciada." });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = iaController;
