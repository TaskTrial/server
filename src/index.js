import express from 'express';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';
import { Server } from 'socket.io';
// import bodyParser from 'body-parser';
import { apiLimiter } from './utils/apiLimiter.utils.js';
import passport from 'passport';
import session from 'express-session';
// import lusca from 'lusca';
import swaggerUi from 'swagger-ui-express';
import router from './routes/index.routes.js';
import {
  errorHandler,
  notFound,
} from './middlewares/errorHandler.middleware.js';
import { configureGoogleStrategy } from './strategies/google-strategy.js';
import setupChatHandlers from './socket/chatHandlers.js';
import setupVideoHandlers from './socket/videoHandlers.js';
import { verifySocketToken } from './middlewares/auth.middleware.js';
import config from './config/env/index.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* eslint no-undef: off */
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO only in non-serverless environments
const isServerless = process.env.VERCEL === '1';
let io;

if (!isServerless) {
  io = new Server(server, {
    cors: {
      origin: [
        process.env.CLIENT_URL || 'http://localhost:5173',
        'http://localhost:5174',
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });
}

// app.use(bodyParser.json());

// Load Swagger documentation only if file exists and not in production
let swaggerDocument;
try {
  const swaggerPath = path.resolve(__dirname, './docs/swagger.json');
  if (fs.existsSync(swaggerPath)) {
    swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }
} catch (error) {
  console.warn('Swagger documentation not available:', error.message);
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: config.env === 'production',
      httpOnly: true,
    },
  }),
);
// app.use(lusca.csrf());

// // Middleware to expose CSRF token
// app.use((req, res, next) => {
//   res.setHeader('X-CSRF-Token', req.csrfToken());
//   next();
// });
app.use(passport.initialize());
app.use(passport.session());

// Cors Policy
app.use(
  cors({
    origin: process.env.CLIENT_URL
      ? [process.env.CLIENT_URL, 'http://localhost:5174']
      : '*',
    credentials: true,
  }),
);

// Helmet
app.use(helmet());

app.use(cookieParser());

// Only configure strategies in non-serverless environment
if (!isServerless) {
  configureGoogleStrategy();
}

// Rate limiter middleware
app.use(apiLimiter);

// Setup logging based on environment
app.use(morgan(config.logLevel));
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.send(`<h1>TaskTrial API - Running in ${config.env} mode</h1>`);
});
app.use(router);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Socket.IO setup only in non-serverless environment
if (!isServerless && io) {
  // Socket.IO middleware for authentication
  io.use(verifySocketToken);

  // Socket.IO connection handler
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id}`);

    // Set up chat handlers for this socket
    const chatHandlers = setupChatHandlers(io, socket, socket.user);

    // Set up video handlers for this socket
    const videoHandlers = setupVideoHandlers(io, socket, socket.user);

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);
      chatHandlers.disconnect();
      videoHandlers.disconnect();
    });
  });
}

// Only start the server if not on Vercel and not in test mode
// or if explicitly requested to start the server
const shouldStartServer =
  !isServerless &&
  (process.env.NODE_ENV !== 'test' || process.env.START_SERVER === 'true');

if (shouldStartServer) {
  server.listen(config.port, () => {
    /* eslint no-console:off */
    console.log(
      `Server is running in ${config.env} environment on port ${config.port}`,
    );
  });
}

// Store server instance in global for tests to access
if (process.env.NODE_ENV === 'test') {
  global.__SERVER__ = server;
}

// Export for serverless use
export default app;
// Export for traditional server use
export { app, server };
