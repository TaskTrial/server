import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import router from '../../routes/index.routes.js';
import {
  errorHandler,
  notFound,
} from '../../middlewares/errorHandler.middleware.js';
import session from 'express-session';
import passport from 'passport';

// Create an express app for testing
/* eslint no-undef: off */
const app = express();

// Setup basic middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session setup
app.use(
  session({
    secret: 'test-session-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());

// CORS
app.use(cors({ origin: '*', credentials: true }));

// Security
app.use(helmet({ contentSecurityPolicy: false }));

// Logging - minimal in test environment
app.use(morgan('dev'));

// Routes
app.use(router);

// Error handlers
app.use(notFound);
app.use(errorHandler);

export { app };
