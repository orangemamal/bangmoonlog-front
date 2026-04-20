import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (Singleton pattern)
if (!admin.apps.length) {
  // Use environment variables for the service account to keep it secure
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Vercel escapes newlines in env variables sometimes, so we unescape them
    privateKey: process.env.FIREBASE_PRIVATE_KEY 
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined,
  };

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('Firebase Admin Initialization Error', error);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS 설정을 최우선으로 배치하여 어떤 에러가 발생해도 응답이 차단되지 않게 합니다.
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); // 로컬(localhost:3000) 접근을 위해 모든 오리진 허용
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ message: 'Missing access token' });
    }

    // 1. Fetch Naver User Profile using the Access Token
    const naverResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!naverResponse.ok) {
        throw new Error(`Naver API responded with status ${naverResponse.status}`);
    }

    const { response: naverUser } = await naverResponse.json();
    
    if (!naverUser || !naverUser.id) {
       throw new Error('Could not parse Naver User Info');
    }

    // 2. Generate Firebase Custom Token
    const uid = `naver:${naverUser.id}`; // Create a unique UID pattern for Naver users
    
    // Custom claims (optional, we can store their email and name in FireStore afterwards)
    const customToken = await admin.auth().createCustomToken(uid, {
        email: naverUser.email,
        name: naverUser.name || naverUser.nickname,
        picture: naverUser.profile_image
    });

    // 3. Return the token to the client
    return res.status(200).json({ 
        firebaseToken: customToken,
        user: {
            id: uid,
            email: naverUser.email,
            name: naverUser.name || naverUser.nickname,
            picture: naverUser.profile_image
        }
    });

  } catch (error: any) {
    console.error('Custom Auth Error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
