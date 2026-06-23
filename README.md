# Plein5 Beegden website

Astro website and menu administration system for Plein5 Cafetaria & Broodjesbar in Beegden, optimized for Cloudflare Workers.

## Run locally

```sh
npm install
npm run dev
```

Open `http://localhost:4321`. The admin area is at `http://localhost:4321/admin`.

For local development, the fallback admin password is:

```txt
plein5-admin
```

Set a private password before publishing.

## Build and deploy

```sh
npm run build
npm run deploy
```

The project uses:

- Astro server output
- `@astrojs/cloudflare`
- Cloudflare Workers
- Optional Cloudflare KV for saved admin menu changes

## Cloudflare setup

The public website can deploy without KV. In that mode, it uses the bundled `data/menu.json` menu.

To make admin menu edits persist in production, create a KV namespace and add it to `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "PLEIN5_MENU",
    "id": "your-production-kv-id",
    "preview_id": "your-preview-kv-id"
  }
]
```

Then add a secret admin password:

```sh
npx wrangler secret put ADMIN_PASSWORD
```

## Menu data

`data/menu.json` is the default seed menu bundled with the Worker. If the `PLEIN5_MENU` KV binding is configured, admin changes are stored there.

If KV is not configured, the site still serves the bundled menu, but saved admin edits will only persist for the local/dev runtime.
