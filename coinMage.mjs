#!/usr/bin/env node

import inquirer from 'inquirer';
import fetch from 'node-fetch';
import ora from 'ora';
import chalk from 'chalk';
import process from 'node:process';

const API_BASE = 'https://api.coingecko.com/api/v3';
let coinListCache = [];

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
  const options = { coin: null, exitAfter: false };

  args.forEach((arg, i) => {
    if (arg === '-c' && args[i + 1]) {
      options.coin = args[i + 1];
    } else if (arg === '-x') {
      options.exitAfter = true;
    }
  });

  return options;
};

const fetchCoinList = async () => {
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
    btc: 'bitcoin', eth: 'ethereum', sol: 'solana', ltc: 'litecoin', ada: 'cardano'
  };
  if (preferredSymbols[normalized]) return preferredSymbols[normalized];

  const idMatch = coins.find(c => c.id.toLowerCase() === normalized);
  if (idMatch) return idMatch.id;

  const symbolMatches = coins.filter(c => c.symbol.toLowerCase() === normalized);
  if (symbolMatches.length === 1) return symbolMatches[0].id;
  if (symbolMatches.length > 1) {
    const nameMatch = symbolMatches.find(c => c.name.toLowerCase().includes('bitcoin'));
    return nameMatch ? nameMatch.id : symbolMatches[0].id;
  }

  const nameMatch = coins.find(c => c.name.toLowerCase() === normalized);
  return nameMatch ? nameMatch.id : null;
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
  console.log(`${chalk.yellow('/top')}       Show top 10 coins by market cap`);
  console.log(`${chalk.yellow('/trending')}  Show trending coins on CoinGecko`);
  console.log(`${chalk.yellow('/help')}      Show this help message`);
  console.log(`${chalk.yellow('/exit')}      Exit the application`);
  console.log(`──────────────────────────────────────────────────────────────────────────────`);
  console.log(chalk.cyanBright(`You can also search by coin name or symbol, like "btc", "ethereum", "solana"`));
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

const main = async () => {
  showTitle();
  const args = parseArgs();

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
      const rawInput = input?.trim().toLowerCase();
      if (!rawInput) {
        console.log(chalk.red('No input received. Try again.'));
        continue;
      }

      switch (rawInput) {
        case '/exit':
          console.log('\nExiting CoinMage. Farewell.\n');
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