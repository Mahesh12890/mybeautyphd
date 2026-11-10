<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/598f7746-7a56-45fb-804e-3649854c701d

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy [.env.example](.env.example) to `.env.local` and replace `MY_GEMINI_API_KEY` with your Gemini API key. The server loads `.env.local` (or `.env`) and keeps the key server-side; do not add a `VITE_` prefix or commit the key.
3. Run the app:
   `npm run dev`

## Deploy to GitHub Pages

The `.github/workflows/deploy.yml` workflow builds the app and deploys `dist` when changes are pushed to `main` or `master`, or when manually started from the Actions tab. In the repository's **Settings → Pages**, set the build and deployment source to **GitHub Actions**.

GitHub Pages hosts only the static frontend. The Express server and Gemini-backed `/api/*` routes are not deployed by this workflow; audio transcription and other server API features need a separately hosted backend.
