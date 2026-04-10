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
      const productosDB = await Product.find({});
      const horaActual = getMexicoHour();

      const trainingData = productosDB.map((p) => ({
        input: {
          precio: p.precio / 100,
          stock: p.stock > 0 ? 1 : 0,
          horario: horaActual / 24,
        },
        output: {
          relevancia: p.estado === "DISPONIBLE" && p.stock > 0 ? 1 : 0,
        },
      }));

      if (trainingData.length === 0) {
        throw new Error("No hay productos disponibles para entrenar");
      }

      net.train(trainingData, { iterations: 2000 });

      const resultados = [];

      // 2. Ejecutar predicciones y actualizar base de datos
      for (const p of productosDB) {
        const output = net.run({
          precio: p.precio / 100,
          stock: p.stock > 0 ? 1 : 0,
          horario: horaActual / 24,
        });

        const score = output.relevancia;

        // Solo guardamos productos con relevancia mayor al 50%
        if (score > 0.5) {
          await Recommendation.findOneAndUpdate(
            { producto_base_id: p._id },
            {
              nombre_producto: p.nombre,
              score_relevancia: score,
              hora_prediccion: horaActual,
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

      // Ordenar resultados por relevancia para la respuesta
      resultados.sort((a, b) => b.valor_numerico - a.valor_numerico);

      // Responder si es una petición HTTP, o loguear si es el CRON
      if (res && typeof res.json === "function") {
        return res.json({
          status: "success",
          hora_entrenamiento: horaActual,
          ranking: resultados,
        });
      }

      console.log(
        `IA: Entrenamiento completado exitosamente a las ${horaActual}:00 hrs`,
      );
    } catch (err) {
      if (res && typeof res.status === "function") {
        return res.status(500).json({ error: err.message });
      }
      console.error("Error en entrenamiento IA:", err.message);
    }
  },

  predict: async (req, res) => {
    try {
      const horaActual = getMexicoHour();

      const topOpciones = await Recommendation.find({
        hora_prediccion: horaActual,
      })
        .sort({ score_relevancia: -1 })
        .limit(5);

      if (topOpciones.length === 0) {
        return res.json({
          tipo: "Compra Rápida",
          message: "No hay sugerencias destacadas para esta hora.",
          hora_sistema: horaActual,
        });
      }

      res.json({
        tipo: "Compra Rápida",
        hora_sistema: horaActual,
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
