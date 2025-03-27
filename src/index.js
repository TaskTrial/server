import express from 'express';
import * as dotenv from 'dotenv';
dotenv.config();
import authRouter from './routes/auth.routes.js';

/* eslint no-undef: off */
const PORT = process.env.PORT;
const app = express();

app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true }));

app.use(authRouter);

app.listen(PORT, () => {
  /* eslint no-console:off */
  console.log(
    `Server is running in ${process.env.NODE_ENV} enviroment on port ${PORT}`,
  );
});
