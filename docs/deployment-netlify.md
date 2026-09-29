# Deploying to Netlify

No build step required.

## Option A: Drag and drop

1. Go to https://app.netlify.com → Add new site → Deploy manually.
2. Drag the `somali-capability-atlas` folder onto the drop zone.
3. The site is live at `<name>.netlify.app` over https.

## Option B: CLI

```
npm install -g netlify-cli
netlify login
cd somali-capability-atlas
netlify deploy --dir=. --prod
```

## Option C: Git integration

1. Push the folder to GitHub/GitLab.
2. Add new site → Import an existing project.
3. Build command: **leave empty**. Publish directory: `.` (root).

## Optional: netlify.toml

```
[build]
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

HTTPS is automatic, so the service worker and PWA install work out of the box.
