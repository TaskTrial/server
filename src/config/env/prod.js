/* eslint no-undef: off */
export default {
  port: 5000,
  env: 'production',
  dbUrl:
    process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_Dc8Bnbr1tZRu@ep-patient-moon-a5wvgbbf-pooler.us-east-2.aws.neon.tech/tasktrial?sslmode=require',

  logLevel: 'common',
};
