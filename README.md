# CoinMage

CoinMage is a lightweight, terminal-based tool for checking real-time cryptocurrency data using the CoinGecko API.

---

## Features

- Search by coin name or symbol (`btc`, `ethereum`, `sol`, etc.)
- Commands:
  - `/top` — Show top 10 coins by market cap
  - `/trending` — Show trending coins on CoinGecko
  - `/help` — List available commands
  - `/exit` — Exit the CLI
- CLI flags:
  - `-c <coin>` — Look up a coin directly
  - `-x` — Exit immediately after showing the coin
- Uses the CoinGecko API
- Caches the coin list to avoid redundant API calls
- Output is clean, minimal, and easy to read

---

## One-liner Install

Run this in your terminal to install globally:

```bash
git clone https://github.com/devin-hart/coinmage.git && cd coinmage && node install.js
