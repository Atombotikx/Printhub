# Firebase & Google Sign-In Setup Guide

This guide will help you set up Firebase Authentication with Google Sign-In for the 3D Print Farm application.

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter project name: `3d-print-farm` or your preferred name
4. Accept terms and click **"Continue"**
5. **Disable** Google Analytics (not needed for auth)
6. Click **"Create project"**
7. Wait for project creation, then click **"Continue"**

## Step 2: Register Your Web App

1. In your Firebase project dashboard, click the **Web icon** (`</>`)
2. Register app nickname: `3D Print Farm Web`
3. **Do NOT** check "Firebase Hosting" (we're using Next.js)
4. Click **"Register app"**
5. You'll see Firebase SDK configuration - **keep this page open**

## Step 3: Get Firebase Config

Copy the config object from the Firebase Console. It looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc123"
};
```

## Step 4: Create Environment Variables

1. In your project root (`d:/3d-print-farm/3d-print-farm/`), create a file named `.env.local`
2. Add the following environment variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
```

Replace the values with your actual Firebase config values from Step 3.

> [!IMPORTANT]
> **Never commit `.env.local` to Git!** It's already in `.gitignore` by default in Next.js projects.

## Step 5: Enable Google Authentication

1. In Firebase Console, go to **Build** → **Authentication**
2. Click **"Get started"**
3. Click the **"Sign-in method"** tab
4. Click **"Google"** from the provider list
5. Toggle **"Enable"** to ON
6. Select a **"Public-facing name"**: `3D Print Farm`
7. Choose a **support email** (your email)
8. Click **"Save"**

## Step 6: Configure Authorized Domains

1. Still in Authentication settings, click the **"Settings"** tab
2. Scroll to **"Authorized domains"**
3. Add your domains:
   - `localhost` (already added by default)
   - If deploying: add your production domain (e.g., `yourdomain.com`)

## Step 7: Test the Setup

1. Restart your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000/login`
3. You should see a "Sign in with Google" button
4. Click it and test the OAuth flow
5. After signing in, you should be redirected back to the app

## Step 8: Optional - Firestore Database (for cart persistence)

If you want to store user carts in Firestore:

1. Go to **Build** → **Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (we'll add rules later)
4. Select a location (choose closest to your users)
5. Click **"Enable"**

### Firestore Security Rules (Important!)

After creating the database, add these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own cart
    match /carts/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can only read/write their own orders
    match /orders/{userId}/{orderId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Troubleshooting

### "Firebase: Error (auth/unauthorized-domain)"
- Add your domain to Authorized Domains (Step 6)

### "Module not found: Can't resolve 'firebase/app'"
- Run `npm install firebase`

### Environment variables not loading
- Restart the Next.js dev server after creating `.env.local`
- Make sure variables start with `NEXT_PUBLIC_`

### Google Sign-In popup blocked
- Allow popups for localhost in your browser
- Or use redirect method instead of popup (modify auth code)

## Next Steps

Once authentication is working:
1. Update the login page UI
2. Add user profile management
3. Link cart data to user ID
4. Implement protected routes for checkout

## Additional Resources

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
