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
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Setup middlewares
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session and authentication
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
app.use(passport.initialize());
app.use(passport.session());

// Cors Policy
app.use(
  cors({
    origin: process.env.CLIENT_URL
      ? [
          process.env.CLIENT_URL,
          'http://localhost:5174',
          'https://tasktrial-prod.vercel.app',
        ]
      : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
);

// Special CORS configuration for Swagger documentation
app.use('/api-docs', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS, PUT, PATCH, DELETE',
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-Requested-With,content-type',
  );
  next();
});

// Helmet for security
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
      },
    },
  }),
);

// Only configure strategies in non-serverless environment
if (!isServerless) {
  configureGoogleStrategy();
}

// Rate limiter middleware
app.use(apiLimiter);

// Setup logging based on environment
app.use(morgan(config.logLevel));

// Load Swagger documentation if available
try {
  // Use a deterministic path based on environment
  const swaggerPath =
    process.env.VERCEL === '1'
      ? path.join(process.cwd(), 'src/docs/swagger.json')
      : path.resolve(__dirname, './docs/swagger.json');

  if (fs.existsSync(swaggerPath)) {
    const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerDocument, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
      }),
    );
  }
} catch (error) {
  console.warn('Swagger documentation not available:', error.message);
}

// Determine the frontend assets directory path
const frontendDistPath =
  process.env.VERCEL === '1'
    ? path.join(process.cwd(), 'public/dist')
    : path.join(__dirname, '../public/dist');

// Serve static files from the frontend build directory
app.use(express.static(frontendDistPath));

// API Routes - all API routes are prefixed with /api
app.use(router);

// Serve the root route by checking if index.html exists in frontend build,
// otherwise fall back to API landing page
app.get('/', (req, res) => {
  try {
    let indexPath;

    // Check if the frontend build exists
    if (process.env.VERCEL === '1') {
      indexPath = path.join(process.cwd(), 'public/dist/index.html');
    } else {
      indexPath = path.join(__dirname, '../public/dist/index.html');
    }

    if (fs.existsSync(indexPath)) {
      // Frontend build exists, serve the index.html
      res.sendFile(indexPath);
    } else {
      // Frontend build doesn't exist, serve API landing page
      const apiLandingPath =
        process.env.VERCEL === '1'
          ? path.join(process.cwd(), 'public/index.html')
          : path.join(__dirname, '../public/index.html');

      let html = fs.readFileSync(apiLandingPath, 'utf8');

      // Extract version from CHANGELOG.md
      let version = '1.0.0';
      try {
        const changelogPath =
          process.env.VERCEL === '1'
            ? path.join(process.cwd(), 'CHANGELOG.md')
            : path.join(__dirname, '../CHANGELOG.md');

        const changelog = fs.readFileSync(changelogPath, 'utf8');
        // Extract version using regex - looks for the first version in format [x.y.z]
        const versionMatch = changelog.match(/## \[(\d+\.\d+\.\d+)\]/);
        if (versionMatch && versionMatch[1]) {
          version = versionMatch[1];
        }
      } catch (versionError) {
        console.warn(
          'Could not read version from CHANGELOG:',
          versionError.message,
        );
        // Fallback to package.json if CHANGELOG read fails
        try {
          const packagePath =
            process.env.VERCEL === '1'
              ? path.join(process.cwd(), 'package.json')
              : path.join(__dirname, '../package.json');
          const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          version = packageJson.version || version;
        } catch (packageError) {
          console.warn(
            'Could not read version from package.json:',
            packageError.message,
          );
        }
      }

      // Replace the environment placeholder with actual environment
      html = html.replace('ENVIRONMENT_PLACEHOLDER', config.env);

      // Replace version placeholder
      html = html.replace('1.0.0', version);

      // Send the HTML response with the correct content type
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
  } catch (error) {
    console.error('Error serving index page:', error);
    // Fallback to simple HTML if file reading fails
    res.send(
      `<h1>TaskTrial API - Running in ${config.env} mode</h1><p>Version: ${process.env.npm_package_version || '1.0.0'}</p>`,
    );
  }
});

// Catch-all route to handle SPA routing on the frontend
// This should be AFTER the API routes but BEFORE the error handlers
app.get('*', (req, res) => {
  // Skip API routes
  if (req.url.startsWith('/api')) {
    return;
  }

  const indexPath =
    process.env.VERCEL === '1'
      ? path.join(process.cwd(), 'public/dist/index.html')
      : path.join(__dirname, '../public/dist/index.html');

  // Check if the file exists before trying to send it
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(500).send(err);
      }
    });
  } else {
    // If the frontend build doesn't exist, send a 404
    res.status(404).send('Frontend not built. Run npm run client:build first.');
  }
});

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
