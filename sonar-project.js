const sonarqubeScanner = require("sonarqube-scanner");

// Esto previene el error "TypeError" detectando automáticamente cómo viene exportada la librería
const scanner = sonarqubeScanner.default || sonarqubeScanner;

scanner(
  {
    serverUrl: "http://localhost:9000",
    options: {
      "sonar.projectKey": "tucampus_b",
      "sonar.projectName": "TuCampus_Backend",
      "sonar.projectVersion": "1.0.0",
      "sonar.token": "sqa_7e84539e988c27dbd313c35201ca523811c7d6c3",

      // Rutas del código fuente (TypeScript)
      "sonar.sources": "src,app.ts,server.ts",
      "sonar.typescript.tsconfigPath": "tsconfig.json",

      // Exclusiones sin dependencias de Jest
      "sonar.exclusions":
        "**/node_modules/**, **/coverage/**, dist/**, prisma/**, *.config.js, **/*.spec.ts, **/*.test.ts",
    },
  },
  () => process.exit(),
);
