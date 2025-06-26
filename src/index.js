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

/* eslint no-undef: off */
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL || 'http://localhost:5173',
      'http://localhost:5174',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// app.use(bodyParser.json());

const swaggerDocument = JSON.parse(
  fs.readFileSync(path.resolve('./src/docs/swagger.json'), 'utf8'),
);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(
  session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
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
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  }),
);

// Helmet
app.use(helmet());

app.use(cookieParser());

configureGoogleStrategy();

// Rate limiter middleware
app.use(apiLimiter);

app.use(morgan('dev'));
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true }));

// Routes
app.use(router);

// Socket.IO middleware for authentication
io.use(verifySocketToken);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

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

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    /* eslint no-console:off */
    console.log(
      `Server is running in ${process.env.NODE_ENV} environment on port ${PORT}`,
    );
  });
}

export { app, server };
