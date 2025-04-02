import express from 'express';
import * as dotenv from 'dotenv';
dotenv.config();
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import { apiLimiter } from './utils/apiLimiter.utils.js';
import passport from 'passport';
import session from 'express-session';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import authRouter from './routes/auth.routes.js';
import {
  errorHandler,
  notFound,
} from './middlewares/errorHandler.middleware.js';
import { configureGoogleStrategy } from './strategies/google-strategy.js';

/* eslint no-undef: off */
const PORT = process.env.PORT;

const app = express();

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TaskTrial APIs',
      version: '1.0.0',
    },
    servers: [{ url: 'http:localhost:3000' }],
  },
  apis: ['./index.js'],
};

const swaggerSpec = swaggerJSDoc(options);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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

app.use(passport.initialize());
app.use(passport.session());

// Cors Policy
app.use(cors());

// Helmet
app.use(helmet());
app.use(helmet.contentSecurityPolicy());

configureGoogleStrategy();

// Rate limiter middleware
app.use(apiLimiter);

app.use(morgan('dev'));
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true }));

app.use(authRouter);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  /* eslint no-console:off */
  console.log(
    `Server is running in ${process.env.NODE_ENV} enviroment on port ${PORT}`,
  );
});
