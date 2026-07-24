# SuperTokens Auth Setup

## 1. Install packages

```bash
cd app
npm install supertokens-node supertokens-web-js
```

## 2. Create a SuperTokens managed account

- Go to https://supertokens.com and sign up (free)
- Create a new app called "UPT Portal"
- Choose "Managed Service" (free tier)
- Copy your Connection URI and API Key from the dashboard

## 3. Set up Google OAuth credentials

- Go to console.cloud.google.com
- Your existing OAuth client is fine — just add this redirect URI:
  http://localhost:3000/auth/callback/google
- Keep your existing Client ID and Secret

## 4. Add environment variables to app/.env.local

```
# SuperTokens
SUPERTOKENS_CONNECTION_URI=https://your-id.aws.supertokens.io:3567
SUPERTOKENS_API_KEY=your-supertokens-api-key

# Google OAuth (same values as before)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Bootstrap admin secret (share this with the first committee head only)
ADMIN_BOOTSTRAP_SECRET=choose-a-long-random-secret
```

## 5. Files to add/update in your repo

New files (copy into app/src/):
- config/supertokens-backend.ts
- config/supertokens-frontend.ts
- components/supertokens-provider.tsx
- app/api/auth/[...path]/route.ts
- app/api/auth/set-admin-role/route.ts
- app/auth/login/page.tsx
- app/auth/register/page.tsx
- app/auth/verify-email/page.tsx
- app/auth/callback/google/page.tsx
- app/dashboard/page.tsx
- middleware.ts

Updated files:
- app/layout.tsx (wraps app with SuperTokensProvider)

## 6. Test locally

```bash
npm run dev
```

- Register at http://localhost:3000/auth/register
- Check your email for the verification link
- Click the link → redirects to dashboard
- Sign out and test login at http://localhost:3000/auth/login
- Test Google login

## How the bootstrap admin works

On the register page there is an optional "Admin access code" field.
If the submitted value matches ADMIN_BOOTSTRAP_SECRET, the user is
created as committee_head instead of general. Leave it blank for
normal member registration.

Share ADMIN_BOOTSTRAP_SECRET with UPT leadership once. They use it
once to create their account, then promote others through the admin UI.
The field is completely optional and silent — wrong codes are ignored,
not flagged.

## Roles

Roles are stored in SuperTokens UserMetadata on each user record:
- "general" — default for all new users
- "campaign_lead" — promoted by committee_head
- "committee_head" — top level, set via bootstrap secret or admin UI

## Vercel env vars (add before deploying)

Add the same variables from .env.local in:
Vercel → Project → Settings → Environment Variables

Also add the production callback URI in Google Cloud Console:
https://your-app.vercel.app/auth/callback/google
