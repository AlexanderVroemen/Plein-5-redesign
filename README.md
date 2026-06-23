# Plein5 Beegden website

A lightweight website and menu administration system for Plein5 Cafetaria & Broodjesbar.

## Run locally

```sh
npm run dev
```

Open `http://127.0.0.1:3000`. The admin area is at `http://127.0.0.1:3000/admin`.

For local preview, the fallback admin password is `plein5-admin`. Always set a private password before publishing:

```sh
ADMIN_PASSWORD='choose-a-strong-password' npm start
```

Menu changes are stored in `data/menu.json`. The example products and the monthly-special description are placeholders and should be replaced with Plein5's current menu before launch.

## Deployment notes

- Requires Node.js 20 or newer and persistent disk storage for `data/menu.json`.
- Serve the website behind HTTPS in production.
- Set `ADMIN_PASSWORD` in the hosting provider's environment settings.
- Replace the generated hero photograph with Plein5's own approved photography when available.
