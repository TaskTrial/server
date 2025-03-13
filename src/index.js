import express from 'express';
import * as dotenv from 'dotenv';
dotenv.config();

/* eslint no-undef: off */
const PORT = process.env.PORT;
const app = express();

app.listen(PORT, () => {
  /* eslint no-console:off */
  console.log(
    `Server is running in ${process.env.NODE_ENV} enviroment on port ${PORT}`,
  );
});
