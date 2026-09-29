# Self-Hosting & Offline Distribution

## Serve on your own server

### Python (simplest)

```
cd somali-capability-atlas
python3 -m http.server 8080
```

App at `http://<host>:8080`. For local development the service worker runs on
localhost; on a LAN over plain http it will be limited by browser rules, but
the app itself works fully.

### Nginx

```
server {
    listen 80;
    server_name atlas.example.org;
    root /var/www/somali-capability-atlas;
    index index.html;

    # Hash routing means no SPA rewrites are required.
    location / {
        try_files $uri $uri/ =404;
    }
}
```

Add TLS (for example with certbot) to enable the service worker and PWA
install on your domain.

### Apache

Drop the folder into the document root. No `.htaccess` needed; hash routing
works without rewrites. If you move the app into a subdirectory, the relative
paths keep working.

## Offline / low-connectivity distribution (designed for field conditions)

The entire atlas is one folder with no build step and no server dependency:

1. Copy the folder to a USB stick, SD card, or phone storage.
2. On any device, open `index.html` directly. The app runs with zero network.
3. Researchers work offline; data is stored in the browser.
4. Data moves between people and devices as JSON files from the Export page.

Planned later (Step 10): a regional data package download plus a proper
offline sync layer for field research: download package, travel offline,
interview, record, return to connectivity, synchronize. The data model and
export/import built in Step 1 are the foundation for that.

## Kiosk / field-laptop setup

For a dedicated device: serve via `python3 -m http.server` at startup, open
the browser in fullscreen at `http://localhost:8080`, and periodically export
the bundle to the device storage or an attached drive.
