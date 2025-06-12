import admin from 'firebase-admin';
import { serviceAccount } from './firebaseService';

try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
  });

  console.log('Firebase Admin SDK initialized successfully!');
} catch (error: any) {
  console.error('Error initializing Firebase Admin SDK:', error.message);
}

export default admin;