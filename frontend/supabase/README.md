# Public document sharing setup

The NOTE app stores documents locally by default. Sharing uploads a selected file
to a private Supabase Storage bucket only after the owner confirms the upload.
Public access is served by Edge Functions; the browser never receives a
service-role key.

## Configure the app

1. Create a Supabase project and copy `.env.example` to `.env`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to that project's URL
   and publishable/anon key. These browser values are public; never use a
   service-role key for either variable.
3. Configure Supabase Auth email sign-up and confirmation for owners.

## Apply the backend

With the Supabase CLI installed and authenticated:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase secrets set ALLOWED_ORIGINS="http://localhost:8080,https://YOUR_SITE_ORIGIN"
supabase functions deploy manage-document-share --no-verify-jwt
supabase functions deploy public-document-share --no-verify-jwt
```

Set `ALLOWED_ORIGINS` to the exact origins that host NOTE, including the local
development origin only when needed. The management function verifies the
owner's access token itself. The public function accepts only the random share
token and exposes an allowlisted document payload.

The migration creates a private bucket, owner-only Storage policies, RLS
protected tables, and an atomic database operation for creating shares. Do not
make the bucket public or grant direct table access to `anon`/`authenticated`.

The "do not allow download" option disables the official download endpoint and
button. It cannot prevent recipients from saving content already rendered in a
browser, copying text, or taking screenshots.
