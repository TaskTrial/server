import express from 'express';
import * as dotenv from 'dotenv';
dotenv.config();
import passport from 'passport';
import session from 'express-session';
import authRouter from './routes/auth.routes.js';
import { configureGoogleStrategy } from './strategies/google-strategy.js';

/* eslint no-undef: off */
const PORT = process.env.PORT;
const app = express();

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

configureGoogleStrategy();

app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true }));

app.use(authRouter);

app.listen(PORT, () => {
  /* eslint no-console:off */
  console.log(
    `Server is running in ${process.env.NODE_ENV} enviroment on port ${PORT}`,
  );
});
