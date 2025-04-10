#!/usr/bin/env node

import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import Table from 'cli-table3';
import fetch from 'node-fetch';
import ora from 'ora';
import chalk from 'chalk';
import process from 'node:process';

const API_BASE = 'https://api.coingecko.com/api/v3';
let coinListCache = [];
let lastCoinListFetch = 0;

const WATCHLIST_DIR = path.resolve('./watchlists');

const preloadCoinList = async () => {
  if (coinListCache.length) return;
  const res = await fetch(`${API_BASE}/coins/list`);
  coinListCache = await res.json();
  lastCoinListFetch = Date.now();
};

const showTitle = () => {
  console.clear();
  console.log(chalk.magentaBright(`
   ██████╗ ██████╗ ██╗███╗   ██╗███╗   ███╗ █████╗  ██████╗ ███████╗
  ██╔════╝██╔═══██╗██║████╗  ██║████╗ ████║██╔══██╗██╔════╝ ██╔════╝
  ██║     ██║   ██║██║██╔██╗ ██║██╔████╔██║███████║██║  ███╗█████╗  
  ██║     ██║   ██║██║██║╚██╗██║██║╚██╔╝██║██╔══██║██║   ██║██╔══╝  
  ╚██████╗╚██████╔╝██║██║ ╚████║██║ ╚═╝ ██║██║  ██║╚██████╔╝███████╗
   ╚═════╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
──────────────────────────────────────────────────────────────────────
  `));
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = { coin: null, exitAfter: false, watchCoins: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-c' && args[i + 1]) {
      options.coin = args[i + 1];
      i++;
    } else if (arg === '-x') {
      options.exitAfter = true;
    } else if (arg === '--watch') {
      options.watchCoins = args.slice(i + 1).filter(a => !a.startsWith("-"));
      break;
    }
  }
  return options;
};

const fetchCoinList = async () => {
  const now = Date.now();
  if (coinListCache.length && (now - lastCoinListFetch < 10 * 60 * 1000)) {
    return coinListCache;
  }
  const spinner = ora('Fetching coin list...').start();
  try {
    const res = await fetch(`${API_BASE}/coins/list`);
    coinListCache = await res.json();
    lastCoinListFetch = Date.now();
    spinner.succeed(`Loaded ${coinListCache.length} coins.`);
    return coinListCache;
  } catch (err) {
    spinner.fail('Failed to fetch coin list');
    throw err;
  }
};

const resolveCoinId = async (input) => {
  const coins = await fetchCoinList();
  const normalized = input.toLowerCase();
  const preferredSymbols = {
    btc: 'bitcoin', eth: 'ethereum', sol: 'solana', ltc: 'litecoin', ada: 'cardano'
  };
  if (preferredSymbols[normalized]) return preferredSymbols[normalized];
  const symbolMatch = coins.find(c => c.symbol.toLowerCase() === normalized);
  if (symbolMatch) return symbolMatch.id;
  const idMatch = coins.find(c => c.id.toLowerCase() === normalized);
  if (idMatch) return idMatch.id;
  const nameMatch = coins.find(c => c.name.toLowerCase() === normalized);
  return nameMatch ? nameMatch.id : null;
};

const formatPrice = (val) => {
  if (val === null || val === undefined) return '-';
  if (typeof val !== 'number') val = Number(val) || 0;
  let formatted = val >= 1 ? val.toFixed(2) : val > 0.0001 ? val.toFixed(4) : val > 0 ? val.toPrecision(4) : val.toFixed(2);
  if (formatted.includes('.')) formatted = formatted.replace(/0+$/g, '').replace(/\.$/, '');
  return `$${formatted}`;
};

const formatChange = (val) => {
  if (val === null || val === undefined) return '-';
  const fixed = val.toFixed(2);
  const sign = val > 0 ? '+' : '';
  return chalk[val > 0 ? 'green' : val < 0 ? 'red' : 'gray'](`${sign}${fixed}%`);
};

const loadWatchlist = async (name) => {
  const filePath = path.join(WATCHLIST_DIR, `${name}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.log(chalk.red(`Failed to load watchlist '${name}': ${err.message}`));
    return null;
  }
};

const getCoinData = async (coinId) => {
  const spinner = ora(`Fetching data for ${coinId}...`).start();
  try {
    const res = await fetch(`${API_BASE}/coins/${coinId}`);
    if (!res.ok) throw new Error('Coin data not found');
    const data = await res.json();
    const m = data.market_data;
    if (!m?.current_price?.usd || typeof m.current_price.usd !== 'number') {
      spinner.fail('No price data available.');
      return;
    }
    spinner.succeed(`Data fetched: ${data.name}`);

    console.log(`\n──────────────────────────────────────────────────────────────────────────────`);
    console.log(`${chalk.bold(data.name)} (${data.symbol.toUpperCase()})`);
    console.log(`──────────────────────────────────────────────────────────────────────────────`);
    console.log(`Rank:             ${data.market_cap_rank}`);
    console.log(`Price:            ${chalk.green(`$${m.current_price.usd.toString()}`)}`);
    console.log(`24h Change:       ${m.price_change_percentage_24h?.toFixed(2) ?? '0.00'}%`);
    console.log(`Market Cap:       $${m.market_cap.usd.toString()}`);
    console.log(`Volume (24h):     $${m.total_volume.usd.toString()}`);
    console.log(`Circulating Supply: ${m.circulating_supply.toString()} ${data.symbol.toUpperCase()}`);
    console.log(`──────────────────────────────────────────────────────────────────────────────\n`);
  } catch (err) {
    spinner.fail('Failed to fetch coin data');
    console.error(chalk.red(err.message));
  }
};

const showTopCoins = async () => {
  const spinner = ora('Fetching top 10 coins...').start();
  try {
    const res = await fetch(`${API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1`);
    const coins = await res.json();
    spinner.succeed('Top 10 Coins:');
    console.log(`──────────────────────────────────────────────────────────────────────────────`);
    coins.forEach((c, i) => {
      console.log(`${i + 1}. ${chalk.bold(c.name)} (${c.symbol.toUpperCase()}) — $${c.current_price.toString()}`);
    });
    console.log(`──────────────────────────────────────────────────────────────────────────────\n`);
  } catch (err) {
    spinner.fail('Failed to fetch top coins');
    console.error(chalk.red(err.message));
  }
};

const showTrendingCoins = async () => {
  const spinner = ora('Fetching trending coins...').start();
  try {
    const res = await fetch(`${API_BASE}/search/trending`);
    const data = await res.json();
    spinner.succeed('Trending Coins:');
    console.log(`──────────────────────────────────────────────────────────────────────────────`);
    data.coins.forEach((c, i) => {
      const coin = c.item;
      console.log(`${i + 1}. ${chalk.bold(coin.name)} (${coin.symbol.toUpperCase()}) — Rank: ${coin.market_cap_rank}`);
    });
    console.log(`──────────────────────────────────────────────────────────────────────────────\n`);
  } catch (err) {
    spinner.fail('Failed to fetch trending coins');
    console.error(chalk.red(err.message));
  }
};

const showHelp = () => {
  console.log(`──────────────────────────────────────────────────────────────────────────────`);
  console.log(chalk.cyanBright(`Available Commands:`));
  console.log(`${chalk.yellow('/top')}        Show top 10 coins by market cap`);
  console.log(`${chalk.yellow('/trending')}   Show trending coins on CoinGecko`);
  console.log(`${chalk.yellow('/watch')}      Start a live watch table with selected coin symbols`);
  console.log(`${chalk.yellow('/load NAME')}  Load and watch a saved watchlist`);
  console.log(`${chalk.yellow('/list')}       List all saved watchlists`);
  console.log(`${chalk.yellow('/help')}       Show this help message`);
  console.log(`${chalk.yellow('/exit')}       Exit the application`);
  console.log(`──────────────────────────────────────────────────────────────────────────────`);
  console.log(chalk.cyanBright(`You can also search by coin name or symbol, like "btc", "solana", "doge"`));
  console.log(`──────────────────────────────────────────────────────────────────────────────\n`);
};

const promptUser = async () => {
  const { input } = await inquirer.prompt([{
    type: 'input',
    name: 'input',
    message: 'Enter coin name, symbol or command:'
  }]);
  return input;
};

const showWatch = async (initialSymbols) => {
  const symbols = initialSymbols.map(s => s.toLowerCase());
  try {
    await fetchCoinList();
  } catch (err) {
    console.error(chalk.red(`Error loading coin list: ${err.message}`));
    return;
  }
  const ids = (await Promise.all(symbols.map(resolveCoinId))).filter(Boolean);
  if (ids.length === 0) {
    console.log(chalk.red('No valid coins found.'));
    return;
  }
  // Set up keypress events for watch mode
  const readline = await import('readline');
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.input.setRawMode(true);
  readline.emitKeypressEvents(rl.input);
  
  rl.input.on('keypress', (str, key) => {
    if (key.name === 'x') {
      exitRequested = true;
      rl.input.setRawMode(false);
      rl.close();
    } else if (key.ctrl && key.name === 'c') {
      rl.input.setRawMode(false);
      rl.close();
      process.exit();
    }
  });
  let exitRequested = false;
  // Handle key presses in watch mode
  const handleKeypress = (_, key) => {
    if (key.name === 'x') {
      exitRequested = true;
    } else if (key.ctrl && key.name === 'c') {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      console.log(chalk.yellow('\nExiting...'));
      process.exit(0);
    }
  };
  process.stdin.on('keypress', handleKeypress);
  const REFRESH_INTERVAL = 60;
  const renderTable = async () => {
    const url = `${API_BASE}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&price_change_percentage=1h,24h,7d,30d`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      console.clear();
      const now = new Date();
      console.log(chalk.magentaBright('Live Coin Watch') + ` (Last updated at ${now.toLocaleTimeString()})`);
      console.log();
      const table = new Table({
        head: ['Name', 'Symbol', 'Price', '1h%', '24h%', '7d%', '30d%'].map(h => chalk.cyan.bold(h)),
        colAligns: ['left', 'left', 'right', 'right', 'right', 'right', 'right'],
        colWidths: [18, 7, 12, 8, 8, 8, 8],
        wordWrap: true,
        style: { border: ['gray'] }
      });
      data.forEach(c => {
        table.push([
          c.name,
          c.symbol.toUpperCase(),
          formatPrice(c.current_price),
          formatChange(c.price_change_percentage_1h_in_currency),
          formatChange(c.price_change_percentage_24h_in_currency),
          formatChange(c.price_change_percentage_7d_in_currency),
          formatChange(c.price_change_percentage_30d_in_currency),
        ]);
      });
      console.log(table.toString());
      console.log(chalk.gray("Press 'x' or CTRL + C to exit."));
    } catch (err) {
      console.log(chalk.red('Failed to load data:'), err.message);
    }
  };
  await renderTable();
  while (!exitRequested) {
    for (let i = 0; i < REFRESH_INTERVAL && !exitRequested; i++) {
      const filled = Math.floor((i / REFRESH_INTERVAL) * 20);
      const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
      const secondsLeft = REFRESH_INTERVAL - i;
      process.stdout.write(`\rNext refresh in: [${bar}] ${secondsLeft}s `);
      await new Promise(res => setTimeout(res, 1000));
    }
    if (!exitRequested) {
      await renderTable();
    }
  }
  process.stdin.removeListener('keypress', handleKeypress);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  if (process.stdout.isTTY) process.stdout.write('\r\x1b[2K');  // Clear progress bar line
  console.log(chalk.green('Exited watch view.'));
};

const main = async () => {
  const args = parseArgs();
  let lastWatchSymbols = [];
  if (args.watchlist) {
    const symbols = await loadWatchlist(args.watchlist);
    if (symbols) {
      await preloadCoinList();
      lastWatchSymbols = symbols;
      await showWatch(symbols);
    }
  }
  if (args.watchCoins.length) {
    await preloadCoinList();
    lastWatchSymbols = args.watchCoins;
    await showWatch(args.watchCoins);
  }
  showTitle();
  if (args.coin) {
    const resolved = await resolveCoinId(args.coin);
    if (resolved) {
      await getCoinData(resolved);
    } else {
      console.log(chalk.red('Coin not found.'));
    }
    if (args.exitAfter) return;
  }
  console.log(chalk.cyanBright('Welcome to CoinMage!'));
  showHelp();
  while (true) {
    try {
      const input = await promptUser();
      const rawInput = input?.trim();
      if (!rawInput) {
        console.log(chalk.red('No input received. Try again.'));
        continue;
      }
      const [command, ...commandArgs] = rawInput.toLowerCase().split(/\s+/);
      switch (command) {
        case '/list':
          try {
            const files = await fs.readdir(WATCHLIST_DIR);
            if (files.length === 0) {
              console.log(chalk.gray("No saved watchlists."));
            } else {
              console.log(chalk.cyanBright("\nSaved Watchlists:"));
              files
                .filter(f => f.endsWith('.json'))
                .forEach(file => console.log("•", file.replace(/\.json$/, "")));
              console.log();
            }
          } catch (err) {
            console.log(chalk.red("Failed to list watchlists:"), err.message);
          }
          break;
        case '/save':
          if (commandArgs.length === 0) {
            console.log(chalk.red("Usage: /save mylist"));
          } else {
            await saveWatchlist(commandArgs[0], lastWatchSymbols);
          }
          break;
        case '/load':
          if (commandArgs.length === 0) {
            console.log(chalk.red("Usage: /load mylist"));
          } else {
            const symbols = await loadWatchlist(commandArgs[0]);
            if (symbols) {
              lastWatchSymbols = symbols;
              await showWatch(symbols);
            }
          }
          break;
        case '/exit':
          console.log('\nExiting CoinMage. Happy trails.\n');
          return;
        case '/top':
          await showTopCoins();
          break;
        case '/trending':
          await showTrendingCoins();
          break;
        case '/help':
          showHelp();
          break;
        case '/watch':
          if (commandArgs.length === 0) {
            console.log(chalk.red("Usage: /watch btc eth sol ..."));
          } else {
            lastWatchSymbols = commandArgs;
            await showWatch(commandArgs);
          }
          break;
        default: {
          const resolved = await resolveCoinId(rawInput);
          if (resolved) {
            await getCoinData(resolved);
          } else {
            console.log(chalk.red('Coin not found.'));
          }
        }
      }
    } catch (err) {
      console.error(chalk.red(`Error during prompt: ${err.message}`));
    }
  }
};
main().catch(err => console.error(chalk.red(`Uncaught Error: ${err.message}`)));

process.on('SIGINT', () => {
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  console.log(chalk.yellow('\nExiting...'));
  process.exit();
});
