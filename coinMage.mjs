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

const preloadCoinList = async () => {
  if (coinListCache.length) return;
  const res = await fetch(`${API_BASE}/coins/list`);
  coinListCache = await res.json();
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
  const options = { coin: null, exitAfter: false, watchCoins: [], watchlist: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--watchlist' && args[i + 1]) {
      options.watchlist = args[i + 1];
      i++;
      continue;
    }
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
  if (coinListCache.length) return coinListCache;
  const spinner = ora('Fetching coin list...').start();
  try {
    const res = await fetch(`${API_BASE}/coins/list`);
    coinListCache = await res.json();
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
      btc: 'bitcoin',
      eth: 'ethereum',
      sol: 'solana',
      ltc: 'litecoin',
      ada: 'cardano'
    };
    if (preferredSymbols[normalized]) return preferredSymbols[normalized];
  
    // First try symbol match
    const symbolMatch = coins.find(c => c.symbol.toLowerCase() === normalized);
    if (symbolMatch) return symbolMatch.id;
  
    // Then try ID match
    const idMatch = coins.find(c => c.id.toLowerCase() === normalized);
    if (idMatch) return idMatch.id;
  
    // Then try name match
    const nameMatch = coins.find(c => c.name.toLowerCase() === normalized);
    return nameMatch ? nameMatch.id : null;
  };

const formatPrice = (val) => {
    return `$${val.toString()}`;
};


const WATCHLIST_DIR = path.resolve('./watchlists');

const saveWatchlist = async (name, symbols) => {
  await fs.mkdir(WATCHLIST_DIR, { recursive: true });
  const filePath = path.join(WATCHLIST_DIR, `${name}.json`);
  await fs.writeFile(filePath, JSON.stringify(symbols, null, 2), 'utf8');
  console.log(chalk.green(`Watchlist '${name}' saved.`));
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



const formatChange = (val) => {
  if (val === null || val === undefined) return '-';
  const fixed = val.toFixed(2);
  const sign = val > 0 ? '+' : '';
  return chalk[val > 0 ? 'green' : val < 0 ? 'red' : 'gray'](`${sign}${fixed}%`);
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
  console.log(`${chalk.yellow('/save NAME')}  Save current watchlist to watchlists/NAME.json`);
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
  let symbols = [...initialSymbols.map(s => s.toLowerCase())];

  const readlineModule = await import('readline');
  readlineModule.emitKeypressEvents(process.stdin);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  const rl = readlineModule.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let exitRequested = false;

  process.stdin.on('keypress', (str) => {
    if (str === 'x') {
      exitRequested = true;
      process.stdin.setRawMode(false);
      rl.close();
    }
  });

  const REFRESH_INTERVAL = 60;

  const renderTable = async () => {
    const resolvedIds = await Promise.all(symbols.map(resolveCoinId));
    const ids = resolvedIds.filter(Boolean);
    if (ids.length === 0) {
      console.log(chalk.red('No valid coins found.'));
      return;
    }

    const url = `${API_BASE}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&price_change_percentage=1h,24h,7d,30d`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      console.clear();
      const now = new Date();
      console.log(`\n${chalk.magentaBright('Live Coin Watch')} (Last updated at ${now.toLocaleTimeString()})`);
      console.log(chalk.gray("Press 'x' or CTRL + C to exit.\n"));
      
const table = new Table({
  head: [
    chalk.bold('Name'),
    chalk.bold('Symbol'),
    chalk.bold('Price'),
    chalk.bold('1h %'),
    chalk.bold('24h %'),
    chalk.bold('7d %'),
    chalk.bold('30d %')
  ],
  colAligns: ['left', 'left', 'right', 'right', 'right', 'right', 'right'],
  style: {
    head: ['cyan'],
    border: ['gray']
  }
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



  // Regular refresh loop
  while (!exitRequested) {
    for (let i = 0; i < REFRESH_INTERVAL; i++) {
      if (exitRequested) break;
      const filled = Math.floor((i / REFRESH_INTERVAL) * 20);
      const empty = 20 - filled;
      const bar = '█'.repeat(filled) + '░'.repeat(empty);
      const secondsLeft = REFRESH_INTERVAL - i;
      process.stdout.write(`\rNext refresh in: [${bar}] ${secondsLeft}s `);
      await new Promise(res => setTimeout(res, 1000));
    }
    if (!exitRequested) {
      await renderTable();
    }
  }

  console.log(chalk.green('\nExited watch view.'));
};


const main = async () => {
    const args = parseArgs();
  if (args.watchlist) {
    const symbols = await loadWatchlist(args.watchlist);
    if (symbols) {
      await preloadCoinList();
      await showWatch(symbols);
      
    }
  }

  if (args.watchCoins.length) {
    await preloadCoinList();
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

  let lastWatchSymbols = [];
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
