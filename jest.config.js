/* eslint-env node */
/* eslint no-undef: off */
export default ({ testType = process.env.TEST_TYPE || 'unit' } = {}) => {
  const isUnit = testType === 'unit';
  const isIntegration = testType === 'integration';

  // Set environment variables based on test type
  if (isUnit) {
    process.env.UNIT_TEST = '1';
  } else {
    process.env.UNIT_TEST = '0';
  }

  return {
    testEnvironment: 'node',
    transform: {
      '^.+\\.(js|jsx|ts|tsx)$': [
        'babel-jest',
        {
          presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
        },
      ],
    },
    moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
    testMatch: [
      isUnit
        ? '**/__tests__/unit/**/*.test.js'
        : '**/__tests__/integration/**/*.test.js',
    ],
    setupFilesAfterEnv: [
      '<rootDir>/src/__tests__/setup.js',
      // Add integration-specific setup file only for integration tests
      ...(isIntegration
        ? ['<rootDir>/src/__tests__/setup.integration.js']
        : []),
    ],
    collectCoverage: isUnit, // Only collect coverage for unit tests
    coverageDirectory: '<rootDir>/coverage',
    coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/'],
    verbose: true,
    testPathIgnorePatterns: ['/node_modules/'],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1',
    },
    transformIgnorePatterns: ['/node_modules/(?!@babel)'],
  };
};
