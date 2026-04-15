const brain = require("brain.js");
const Recommendation = require("../models/IaModel");
const Product = require("../models/productModel");

// Instancia de la red neuronal persistente en el servidor
let net = new brain.NeuralNetwork({ hiddenLayers: [4, 4] });

/**
 * Obtiene la hora actual de CDMX
 */
const getMexicoHour = () => {
  const str = new Date().toLocaleString("en-US", {
    timeZone: "America/Mexico_City",
  });
  return new Date(str).getHours();
};

const iaController = {
  /**
   * 1. TRAIN: Entrenamiento de la red neuronal.
   * Ejecutado por Cron Job (server.js) o manualmente por Admin_C.
   */
  train: async (req, res) => {
    try {
      const horaActual = getMexicoHour();

      // Buscamos productos de CAFETERIA disponibles (Regex para ignorar case-sensitive)
      const productosDB = await Product.find({
        tipo: { $regex: /^cafeteria$/i },
        estado: "DISPONIBLE",
      });

      if (productosDB.length === 0) {
        const errorMsg =
          "IA: No se encontraron productos de cafetería disponibles.";
        console.warn(errorMsg);
        if (res && typeof res.status === "function") {
          return res.status(404).json({ error: errorMsg });
        }
        return;
      }

      // Preparación de datos para Brain.js
      const trainingData = productosDB.map((p) => ({
        input: {
          precio: p.precio / 500, // Normalización simple
          stock: p.stock > 0 ? 1 : 0,
          horario: horaActual / 24,
        },
        output: { relevancia: p.stock > 5 ? 1 : 0.3 },
      }));

      // Entrenamiento
      net.train(trainingData, { iterations: 2000 });

      // Preparar actualización masiva (Bulk) para Recommendations
      const bulkOps = productosDB.map((p) => {
        const output = net.run({
          precio: p.precio / 500,
          stock: p.stock > 0 ? 1 : 0,
          horario: horaActual / 24,
        });

        return {
          updateOne: {
            filter: { producto_base_id: p._id, hora_prediccion: horaActual },
            update: {
              nombre_producto: p.nombre,
              precio: p.precio,
              categoria: p.categoria || "General",
              imagenUrl: p.imagenUrl,
              score_relevancia: output.relevancia,
              ultima_actualizacion: new Date(),
            },
            upsert: true,
          },
        };
      });

      // Ejecución masiva en MongoDB
      await Recommendation.bulkWrite(bulkOps);

      console.log(
        `IA: Entrenamiento exitoso - ${productosDB.length} productos procesados (${horaActual}:00 hrs)`,
      );

      if (res && typeof res.json === "function") {
        return res.json({
          status: "success",
          items: productosDB.length,
          hora: horaActual,
        });
      }
    } catch (err) {
      console.error("IA Train Error:", err.message);
      if (res && typeof res.status === "function") {
        return res.status(500).json({ error: err.message });
      }
    }
  },

  /**
   * 2. ASK: Búsqueda semántica para alumnos.
   * Filtra por presupuesto y etiquetas inferidas.
   */
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
      if (/dulce|postre|antojo|chocolate|azucar|galleta/i.test(p))
        tags.push("Postre", "Dulce");
      if (/bebida|tomar|sed|cafe|frio|caliente|agua|jugo/i.test(p))
        tags.push("Bebida", "Café", "Refresco");
      if (/hambre|comida|salado|torta|lunch|sandwich/i.test(p))
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

  /**
   * 3. RESULTS: Consulta de tendencias actuales.
   * Usado para el feed principal de la IA.
   */
  results: async (req, res) => {
    try {
      const horaActual = getMexicoHour();
      const sugerencias = await Recommendation.find({
        hora_prediccion: horaActual,
      })
        .sort({ score_relevancia: -1 })
        .limit(6);

      res.json({ tipo: "Tendencias de la hora", sugerencias });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * 4. RESET: Borra el conocimiento y limpia la red neuronal.
   */
  reset: async (req, res) => {
    try {
      await Recommendation.deleteMany({});
      // Reiniciamos la instancia para limpiar pesos
      net = new brain.NeuralNetwork({ hiddenLayers: [4, 4] });

      res.json({
        status: "success",
        message: "Memoria de IA limpiada correctamente.",
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = iaController;
