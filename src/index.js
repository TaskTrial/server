import express from 'express';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { apiLimiter } from './utils/apiLimiter.utils.js';
import passport from 'passport';
import session from 'express-session';
import swaggerUi from 'swagger-ui-express';
import authRouter from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import orgRouter from './routes/organization.routes.js';
import teamRoutes from './routes/team.routes.js';
import projectRoutes from './routes/project.routes.js';
// import taskRoutes from './routes/task.routes.js';
import {
  errorHandler,
  notFound,
} from './middlewares/errorHandler.middleware.js';
import departmentRoutes from './routes/department.routes.js';
import { configureGoogleStrategy } from './strategies/google-strategy.js';

/* eslint no-undef: off */
const PORT = process.env.PORT;

const app = express();

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

app.use(passport.initialize());
app.use(passport.session());

// Cors Policy
app.use(
  cors({
    credentials: true, // allow cookies
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
app.use(authRouter);
app.use(orgRouter);
app.use(userRoutes);
app.use(departmentRoutes);
app.use(teamRoutes);
app.use(projectRoutes);
// app.use(taskRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  /* eslint no-console:off */
  console.log(
    `Server is running in ${process.env.NODE_ENV} enviroment on port ${PORT}`,
  );
});
