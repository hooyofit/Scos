# Deployment Guides

The atlas is a static, standards-based PWA. The same folder deploys anywhere
static files are served, with no build step.

## General steps (any host)

1. Upload/copy the project folder to the host.
2. Ensure `index.html` is served at the root (or adjust relative paths; all
   paths in the app are relative, so subdirectory hosting works too).
3. Serve over **https** if you want service worker caching and PWA install.
   On `http://localhost` they also work for development.
4. Done. There is no backend to configure in Step 1; data lives in each
   user's browser and moves between devices via JSON export/import.

Host-specific guides:

- [Cloudflare Pages](deployment-cloudflare-pages.md)
- [Netlify](deployment-netlify.md)
- [Self-hosted / offline distribution](deployment-self-hosted.md)

## GitHub Pages

1. Push the project folder to a repository.
2. Settings → Pages → Source: deploy from branch, branch `main`, folder `/ (root)`.
3. The app is served at `https://<user>.github.io/<repo>/`. Hash routing means
   no server rewrites are needed.

## Environment notes

| Environment | Works? | Notes |
|---|---|---|
| file:// (double-click index.html) | Yes | No service worker / PWA install; data still in localStorage |
| http://localhost | Yes | Service worker active |
| https:// (any static host) | Yes | Full PWA: installable, offline shell cached |

## Future backend (later build steps)

The data layer and auth are abstractions (`SCA.store`, `SCA.auth`). When a
hosted backend arrives (Base44, Supabase, or an own API), only the adapter
implementations change. The JSON bundle format is the migration path for data.
