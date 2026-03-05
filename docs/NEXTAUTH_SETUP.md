# NextAuth.js Setup Guide (Google OAuth)

## Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client IDs**
5. Configure consent screen if prompted:
   - User Type: **External**
   - App name: `3D Print Farm`
   - Support email: your email
   - Add scopes: `email`, `profile`
6. Application type: **Web application**
7. Name: `3D Print Farm Web Client`
8. Authorized JavaScript origins:
   - `http://localhost:3000`
   - Add your production domain later
9. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - Add production URL later: `https://yourdomain.com/api/auth/callback/google`
10. Click **Create**
11. Copy **Client ID** and **Client Secret**

## Step 2: Environment Variables

Create/update `.env.local`:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_secret_here

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

To generate `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

Or use: https://generate-secret.vercel.app/32

## Step 3: Test Authentication

1. Restart dev server: `npm run dev`
2. Go to `http://localhost:3000/login`
3. Click "Sign in with Google"
4. You should see Google OAuth consent screen
5. After signing in, you'll be redirected back

## Production Setup

When deploying, update:
1. Add production domain to Google Console
2. Update `NEXTAUTH_URL` to your production URL
3. Keep `NEXTAUTH_SECRET` secure

## Troubleshooting

**Error: redirect_uri_mismatch**
- Check redirect URI matches exactly in Google Console

**Error: invalid_client**
- Verify Client ID and Secret are correct
- Check no extra spaces in `.env.local`

**Session not persisting**
- Restart Next.js dev server after changing env variables
