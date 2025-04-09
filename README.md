# CoinMage

CoinMage is a lightweight, terminal-based tool for checking real-time cryptocurrency data using the CoinGecko API.

---

## Features

- Search by coin name or symbol (`btc`, `ethereum`, `sol`, etc.)
- Smart autocomplete for IDs (even if you enter the full name)
- Live `/watch` mode with real-time price table
- Save and load watchlists to/from disk
- Commands:
  - `/top` — Show top 10 coins by market cap
  - `/trending` — Show trending coins on CoinGecko
  - `/watch btc eth sol` — Watch specific coins
  - `/save <name>` — Save current watchlist
  - `/load <name>` — Load a saved watchlist
  - `/list` — List all saved watchlists
  - `/help` — List available commands
  - `/exit` — Exit the CLI
- CLI Flags:
  - `--watch <symbols...>` — Immediately launch a watch table
  - `--watchlist <name>` — Load and watch a saved watchlist
  - `-c <coin>` — Look up a coin directly
  - `-x` — Exit after showing the coin
- Coin list is cached in memory
- Color-coded % changes (green for positive, red for negative)
- Auto-refreshes every 60 seconds with smooth progress bar
- Lightweight, fast, terminal-native
## One-liner Install

Run this in your terminal to install globally:

```bash
git clone https://github.com/devin-hart/coinmage.git && cd coinmage && node install.js
```