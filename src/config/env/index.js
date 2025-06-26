import merge from 'lodash.merge';
import localConfig from './local.js';
import prodConfig from './prod.js';
import testingConfig from './testing.js';
import * as dotenv from 'dotenv';

/* eslint no-undef: off */
// Load environment variables from .env file
dotenv.config();

// Determine which stage/environment we're in
const stage = process.env.STAGE || 'local';

// Set NODE_ENV based on STAGE if not explicitly provided
if (!process.env.NODE_ENV) {
  switch (stage) {
    case 'production':
      process.env.NODE_ENV = 'production';
      break;
    case 'test':
      process.env.NODE_ENV = 'testing';
      break;
    default:
      process.env.NODE_ENV = 'development';
  }
}

let envConfig;

// Select environment config based on stage
switch (stage) {
  case 'production':
    envConfig = prodConfig;
    break;
  case 'test':
    envConfig = testingConfig;
    break;
  default:
    envConfig = localConfig;
}

// Create final config by merging base config with environment-specific config
const config = merge(
  {
    stage,
    env: process.env.NODE_ENV,
    port: process.env.PORT || 3000,
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  },
  envConfig,
);

export default config;
