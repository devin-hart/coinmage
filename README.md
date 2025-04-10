# CoinMage

CoinMage is a lightweight, terminal-based tool for checking real-time cryptocurrency data using the CoinGecko API. It's fast, minimal, and built for people who want to watch coins without opening a browser.

---

## Features

- Search by coin name or symbol (`btc`, `ethereum`, `sol`, etc.)
- Smart autocomplete for IDs (even if you enter the full name)
- Live `/watch` mode with real-time price table
- Load watchlists from disk
- Color-coded price changes (green for positive, red for negative)
- Auto-refreshes every 60 seconds with a clean progress bar

---

## Commands

```
/top                                  Show top 10 coins by market cap
/trending                             Show trending coins on CoinGecko
/watch <symbols>                      Start a live price table with given coins
/load <name>                          Load and watch a saved watchlist
/list                                 List all saved watchlists
/delete <name>                        Delete a saved watchlist
/help                                 Show this help message
/exit                                 Exit the application
```

---

## CLI Flags

```
--watch <symbols...>       Launch directly into a watch table
--watchlist <name>         Load a saved watchlist by name
-c <coin>                  Quick lookup for a single coin
-x                         Exit immediately after lookup
```

---

## Install

```bash
git clone https://github.com/devin-hart/coinmage.git && cd coinmage && node install.js
```