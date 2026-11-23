# 🍀 Lucky Lucky

[한국어](README.md) · **English**

A 5-minute lunchtime brain survival game. Everyone joins the same room on their own phone or PC and solves puzzles together. Up to 50 players.

▶ **Play: https://luckylucky.lunchtime.workers.dev**

## About

- One person creates a room (1, 2 or 3 rounds); others join by QR code or a 4-digit code. The host starts the game.
- Each round picks 3 random games, and the puzzles get harder within each game. Every puzzle is generated fresh by code.
- Brain games: number sequences · shape matrices · hidden rules · liars · line-up order · day-of-week · mental math · odd one out · clock angles · fruit equations · balance scales · counting · block counting · rotations · quick memory · rectangle hunt
- Mind games: minority survives · ⅔ of the average · grab-or-wait

## Rules

- You start with 10 coins.
- Answer correctly in the first half of the time: +3. Correct but late: +2. Wrong: −1.
- Last place after round 2 is ⚠ in danger. The final round is a coin bet (players in danger must bet at least half).
- Whoever finishes last is "☕ on coffee duty today".

## Run locally

```sh
npm install
npm run dev        # http://127.0.0.1:8793
```

Add `?games=rect,mat,liar` to the URL to pick which games to play (for testing).

## Code map

| Path | What's there |
|---|---|
| `server/worker.js` | Cloudflare Worker + Durable Object `Room` (one per room code) runs the game |
| `public/js/puzzles.js` | Puzzle generators (shared by server and client) |
| `public/js/app.js` | Player screen (same on phone and PC) |
| `public/vendor/` | qrcode-generator (MIT) · jsQR (Apache-2.0) |
