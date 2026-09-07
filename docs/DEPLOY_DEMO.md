# Deploy the demo

Current public deployment: [SkillForge](https://skillforge.honey-chick-7267.chatgpt.site). Published successfully with public access on 2026-09-07. Visit `/demo` for the labeled sample workspace. Deployment status is verified; browser UI QA remains blocked in the creation environment.

The app exposes `/demo` without an app-owned login, database or API key. Hosting platforms may impose their own access policy. A privately deployed Work Site is not a public anonymous GitHub demo.

## Build/runtime

This repository uses Vinext/Vite and a Cloudflare Worker entry, not a standard `next build` Vercel application. `npm run build` produces `dist/server/index.js`, `dist/client/` and deployment metadata. Use Node.js 22.13+ on Linux/WSL; `npm run build:portable` invokes the same compiler without the GNU timeout wrapper for other systems.

For local use:

```bash
npm ci
npm run dev
```

For Cloudflare Workers, prepare your own account, verify the current Wrangler deployment settings and bind the generated static assets alongside the generated Worker. The supplied Work Sites deployment helper is environment-specific; do not assume a generated Worker archive is directly suitable for GitHub Pages.

## Public static alternative

The UI is browser-local, so a future Vite SPA/static-export adapter can target GitHub Pages or Cloudflare Pages. That deployment adapter is not claimed to be complete in v0.1.0. Do not select Next.js defaults on Vercel and assume they match this Vinext worker build.

## After public deployment

Verify `/`, `/demo`, asset loading, refresh behavior, narrow layouts, import/export and local persistence in a real browser without signing in. Only then set the repository Homepage to the public `/demo` URL, and replace the README's deployment status with the verified link. Run `SKILLFORGE_PUBLIC_DEMO_URL=<verified-url> node scripts/publish-github.mjs` to set metadata through your authenticated GitHub CLI.

Never put model keys into deployment environment variables exposed to browser code. Demo visitors should use offline mode unless they explicitly configure their own provider.
