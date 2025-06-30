const baseConfig = {
  bail: true,
  testEnvironment: 'node',
  testMatch: ['**/__tests__/e2e/**/*.e2e.test.js'],
  verbose: true,
  transform: {
    '^.+\\.jsx?$': [
      'babel-jest',
      {
        configFile: './babel.config.json',
        plugins: ['@babel/plugin-syntax-import-meta'],
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!(.*(socket.io|engine.io))/)'],
  setupFilesAfterEnv: ['./src/__tests__/setup.e2e.js'],
  testTimeout: 60000,
};

export default baseConfig;
