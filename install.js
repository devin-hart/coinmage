#!/usr/bin/env node

import { execSync } from 'child_process';
import chalk from 'chalk';

const showBanner = () => {
  console.clear();
  console.log(chalk.cyanBright(`
   ██████╗ ██████╗ ██╗███╗   ██╗███╗   ███╗ █████╗  ██████╗ ███████╗
  ██╔════╝██╔═══██╗██║████╗  ██║████╗ ████║██╔══██╗██╔════╝ ██╔════╝
  ██║     ██║   ██║██║██╔██╗ ██║██╔████╔██║███████║██║  ███╗█████╗  
  ██║     ██║   ██║██║██║╚██╗██║██║╚██╔╝██║██╔══██║██║   ██║██╔══╝  
  ╚██████╗╚██████╔╝██║██║ ╚████║██║ ╚═╝ ██║██║  ██║╚██████╔╝███████╗
   ╚═════╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝

            Installing CoinMage CLI
───────────────────────────────────────────────────────────────────
  `));
};

const runCommand = (command, label) => {
  try {
    console.log(chalk.yellow(`▶ ${label}...`));
    execSync(command, { stdio: 'inherit' });
  } catch (err) {
    console.error(chalk.red(`✖ Failed during: ${label}`));
    process.exit(1);
  }
};

const main = () => {
  showBanner();
  runCommand('npm install', 'Installing dependencies');
  runCommand('npm link', 'Linking CoinMage globally');
  console.log(chalk.greenBright('\n✔ CoinMage is ready! Type ') + chalk.cyan('coinmage') + chalk.greenBright(' to launch.'));
};

main();