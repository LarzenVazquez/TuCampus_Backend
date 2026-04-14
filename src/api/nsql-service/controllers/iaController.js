const brain = require("brain.js");
const Recommendation = require("../models/IaModel");
const Product = require("../models/productModel");

let net = new brain.NeuralNetwork({ hiddenLayers: [4, 4] });

const getMexicoHour = () => {
  const str = new Date().toLocaleString("en-US", {
    timeZone: "America/Mexico_City",
  });
  return new Date(str).getHours();
};

const iaController = {
  // 1. TRAIN: Entrenamiento de la red neuronal
  // Busca productos de cafetería ignorando mayúsculas/minúsculas
  train: async (req, res) => {
    try {
      const horaActual = getMexicoHour();

      // Filtro flexible con Regex para evitar el error de "No hay productos"
      const productosDB = await Product.find({
        tipo: { $regex: /^cafeteria$/i },
        estado: "DISPONIBLE",
      });

      if (productosDB.length === 0) {
        console.error(
          "Error: No se encontraron productos con tipo 'Cafeteria' y estado 'DISPONIBLE'",
        );
        if (res)
          return res.status(404).json({
            error: "No hay productos de cafetería disponibles para entrenar.",
          });
        return;
      }

      const trainingData = productosDB.map((p) => ({
        input: {
          precio: p.precio / 500,
          stock: p.stock > 0 ? 1 : 0,
          horario: horaActual / 24,
        },
        output: { relevancia: p.stock > 5 ? 1 : 0.3 },
      }));

      net.train(trainingData, { iterations: 2000 });

      // Guardar predicciones en la base de datos de Recomendaciones
      for (const p of productosDB) {
        const output = net.run({
          precio: p.precio / 500,
          stock: p.stock > 0 ? 1 : 0,
          horario: horaActual / 24,
        });

        await Recommendation.findOneAndUpdate(
          { producto_base_id: p._id, hora_prediccion: horaActual },
          {
            nombre_producto: p.nombre,
            precio: p.precio,
            categoria: p.categoria || "General",
            imagenUrl: p.imagenUrl,
            score_relevancia: output.relevancia,
            ultima_actualizacion: new Date(),
          },
          { upsert: true },
        );
      }

      console.log(
        `IA Entrenada con ${productosDB.length} productos a las ${horaActual}:00 hrs.`,
      );
      if (res)
        res.json({
          status: "success",
          items: productosDB.length,
          hora: horaActual,
        });
    } catch (err) {
      console.error("Error en train:", err.message);
      if (res) res.status(500).json({ error: err.message });
    }
  },

  // 2. ASK: Búsqueda por lenguaje natural y presupuesto
  ask: async (req, res) => {
    try {
      const { prompt } = req.query;
      if (!prompt) return res.status(400).json({ error: "Prompt vacío" });

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

      const sugerencias = await Recommendation.find(query)
        .sort({ score_relevancia: -1 })
        .limit(4);

      res.json({ sugerencias });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 3. RESULTS: Tendencias actuales basadas en la hora
  results: async (req, res) => {
    try {
      const horaActual = getMexicoHour();
      const sugerencias = await Recommendation.find({
        hora_prediccion: horaActual,
      })
        .sort({ score_relevancia: -1 })
        .limit(6);
      res.json({ tipo: "Tendencias Actuales", sugerencias });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  // 4. RESET: Limpieza de datos y reinicio de red neuronal
  reset: async (req, res) => {
    try {
      await Recommendation.deleteMany({});
      net = new brain.NeuralNetwork({ hiddenLayers: [4, 4] });
      res.json({ status: "success", message: "IA Reiniciada correctamente" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = iaController;
