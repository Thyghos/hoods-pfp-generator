# HOODS PFP Generator

Upload a Telegram, Discord, or X profile picture and **add a hood**.

Brand-matched to [rhoods.xyz](https://www.rhoods.xyz/) — lime `#70c810`, red feather, dark UI.

## Run locally

```bash
npm install
npm run dev
```

## Features

- Upload / drag-and-drop any square-ish PFP
- Drag to reposition, scroll or slider to scale, rotate
- Hood colors: brand green + black / forest / maroon / steel
- Optional red feather + mascot void-eyes mode
- Download a 1024×1024 PNG (no watermark)
- Share to X / Telegram (downloads PNG, then opens X compose or Telegram share)

## Notes

The hood is a **3D PNG overlay** (`public/overlays/hood-3d.png`) matched to the site mascot sweatshirt. Other colors recolor the fabric at runtime; the red feather stays.
