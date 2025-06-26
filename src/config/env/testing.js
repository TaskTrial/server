/* eslint no-undef: off */
export default {
  port: 4000,
  env: 'testing',
  dbUrl:
    process.env.TEST_DB_URL ||
    'postgresql://dawoud:mohamed@2710@localhost:5432/taskhive',
  logLevel: 'silent',
};
