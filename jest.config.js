/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": ["ts-jest", { isolatedModules: true }],
  },
  rootDir: ".",
  testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
  setupFiles: ["<rootDir>/src/__tests__/setupEnv.ts"],
  testTimeout: 20000,
  testPathIgnorePatterns: ["/node_modules/", "kdsFlowModel.test.ts"],
};
