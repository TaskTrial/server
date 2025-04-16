import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Absolute path to serviceAccountKey.json
const serviceAccountPath = resolve(
  __dirname,
  '../config/serviceAccountKey.json',
); // Load and parse the Firebase service account credentials
const serviceAccountJson = await readFile(serviceAccountPath, 'utf-8');
const serviceAccount = JSON.parse(serviceAccountJson);

// Initialize Firebase Admin SDK
const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default firebaseAdmin;
