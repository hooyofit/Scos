# Deploying to Cloudflare Pages

No build step required.

## Option A: Dashboard (drag and drop)

1. Go to https://dash.cloudflare.com → Workers & Pages → Create → Pages.
2. Choose **Upload assets** (direct upload).
3. Drag the `somali-capability-atlas` folder.
4. Deploy. Your site is live at `<project>.pages.dev` over https, so the
   service worker and PWA install work.

## Option B: Wrangler CLI

```
npm install -g wrangler
wrangler login
cd somali-capability-atlas
wrangler pages deploy . --project-name somali-capability-atlas
```

## Option C: Git integration

1. Push the folder to GitHub/GitLab.
2. Workers & Pages → Create → Pages → Connect to Git.
3. Build command: **none**. Output directory: `/` (root).
4. Every push redeploys automatically.

## Notes

- HTTPS is automatic, which is what enables PWA install and offline shell.
- No environment variables or secrets are needed in Step 1.
- Backups: use the in-app Export page or `wrangler pages deployment list` is
  not data backup: data lives in each user's browser. National data
  consolidation arrives in later build steps.
