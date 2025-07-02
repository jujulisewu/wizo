import blessed from 'blessed';
import axios from 'axios';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import cfonts from 'cfonts';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class WizoMiner {
  static allTokens = [];

  constructor(token, refresh_token, proxy = null, id) {
    this.token = token;
    this.refresh_token = refresh_token;
    this.proxy = proxy;
    this.id = id;
    this.userInfo = {};
    this.tasks = { allTasks: [], completedTasks: [] };
    this.uncompletedTaskIds = [];
    this.status = 'Idle';
    this.nextMining = '-';
    this.totalPoints = 0;
    this.minerPoints = 0;
    this.walletAddress = 'N/A';
    this.banned = false;
    this.ipAddress = 'N/A';
    this.miningInterval = null;
    this.countdownInterval = null;
    this.uiScreen = null;
    this.accountPane = null;
    this.logPane = null;
    this.isDisplayed = false;
    this.logs = [];
  }

  async start() {
    this.addLog(chalk.yellow('Starting Miner initialization'));
    await this.fetchIpAddress();
    await this.fetchUserInfo();
    await this.checkAndCompleteTasks();
    await this.startMining();
    this.startUserInfoRefresh();
    this.addLog(chalk.green('Miner initialization Completed'));
  }

  async fetchIpAddress() {
    try {
      let config = {
        headers: {
          'user-agent': this.getRandomUserAgent(),
          'accept': 'application/json, text/plain, */*',
        },
      };
      if (this.proxy) {
        const agent = this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url);
        config = { ...config, httpsAgent: agent, httpAgent: agent };
      } else {
        this.addLog(chalk.yellow('No proxy configured'));
      }
      const response = await axios.get('https://api.ipify.org?format=json', config);
      this.ipAddress = response.data.ip;
    } catch (error) {
      this.ipAddress = 'Unknown';
      this.addLog(chalk.red(`Failed to fetch IP: ${error.message}`));
    }
  }

  getHeaders() {
    return {
      'accept': '*/*',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlueW14c3ZwbWtmd25sbW93enBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4NzQxNDMsImV4cCI6MjA2MjQ1MDE0M30.cf5QLGWwACBbUwNfZMwqoIEGXAEyKTRQiBzd3LPV-KI',
      'authorization': `Bearer ${this.token}`,
      'cache-control': 'no-cache',
      'content-profile': 'public',
      'content-type': 'application/json',
      'origin': 'https://wizolayer.xyz',
      'pragma': 'no-cache',
      'priority': 'u=1, i',
      'referer': 'https://wizolayer.xyz/',
      'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Opera";v="119"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site',
      'user-agent': this.getRandomUserAgent(),
      'x-client-info': 'supabase-js-web/2.49.4',
    };
  }

  async refreshToken() {
    try {
      this.addLog(chalk.yellow('Token expired, attempting to refresh'));
      const payload = { refresh_token: this.refresh_token };
      const response = await axios.post('https://inymxsvpmkfwnlmowzpi.supabase.co/auth/v1/token?grant_type=refresh_token', payload, {
        headers: {
          'accept': '*/*',
          'accept-encoding': 'gzip, deflate, br, zstd',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlueW14c3ZwbWtmd25sbW93enBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4NzQxNDMsImV4cCI6MjA2MjQ1MDE0M30.cf5QLGWwACBbUwNfZMwqoIEGXAEyKTRQiBzd3LPV-KI',
          'authorization': `Bearer ${this.token}`,
          'cache-control': 'no-cache',
          'content-type': 'application/json;charset=UTF-8',
          'origin': 'https://wizolayer.xyz',
          'pragma': 'no-cache',
          'priority': 'u=1, i',
          'referer': 'https://wizolayer.xyz/',
          'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Opera";v="119"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'cross-site',
          'user-agent': this.getRandomUserAgent(),
          'x-client-info': 'supabase-js-web/2.49.4',
          'x-supabase-api-version': '2024-01-01',
        },
        ...(this.proxy ? {
          httpsAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
          httpAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
        } : {}),
      });
      const data = response.data;
      this.token = data.access_token;
      this.refresh_token = data.refresh_token;
      const tokenIndex = WizoMiner.allTokens.findIndex(t => t.id === this.id);
      if (tokenIndex !== -1) {
        WizoMiner.allTokens[tokenIndex].token = this.token;
        WizoMiner.allTokens[tokenIndex].refresh_token = this.refresh_token;
      }
      await WizoMiner.saveTokens(WizoMiner.allTokens);
      this.addLog(chalk.green('Token refreshed successfully'));
    } catch (error) {
      this.addLog(chalk.red(`Failed to refresh token: ${error.message}`));
      throw error;
    }
  }

  async fetchUserInfo() {
    try {
      const payload = { "in_referral_code": null, "in_half_linked_wallet": null };
      const response = await axios.post('https://inymxsvpmkfwnlmowzpi.supabase.co/rest/v1/rpc/handle_auth', payload, {
        headers: this.getHeaders(),
        ...(this.proxy ? {
          httpsAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
          httpAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
        } : {}),
      });
      const data = response.data;
      this.userInfo = data.user;
      this.tasks = data.tasks;
      this.uncompletedTaskIds = this.tasks.allTasks.filter(task => !task.completed).map(task => task.id);
      this.walletAddress = data.user.wallet_address || 'N/A';
      this.totalPoints = data.user.total_earned || 0;
      this.minerPoints = data.user.total_mined || 0;
      this.banned = data.user.banned || false;
      if (this.banned) {
        this.status = 'Banned';
        this.nextMining = '-';
        if (this.miningInterval) clearInterval(this.miningInterval);
        if (this.countdownInterval) clearInterval(this.countdownInterval);
      } else if (data.user.mining_active) {
        this.status = 'Mining Active';
        const miningStarted = new Date(data.user.mining_started);
        const now = new Date();
        const elapsed = now - miningStarted;
        const remaining = 24 * 60 * 60 * 1000 - elapsed;
        if (remaining > 0) {
          this.nextMining = this.formatTime(remaining);
        } else {
          this.nextMining = 'Ready to mine again';
          this.status = 'Idle';
          if (this.miningInterval) clearInterval(this.miningInterval);
        }
      } else {
        this.status = 'Idle';
        this.nextMining = '-';
        if (this.miningInterval) clearInterval(this.miningInterval);
        if (this.countdownInterval) clearInterval(this.countdownInterval);
      }
      this.addLog(chalk.green('User info fetched successfully'));
      this.refreshDisplay();
    } catch (error) {
      if (error.response && error.response.status === 401) {
        this.addLog(chalk.red('Invalid token: Unauthorized (401), attempting to refresh token'));
        try {
          await this.refreshToken();
          await this.fetchUserInfo();
        } catch (refreshError) {
          this.addLog(chalk.red('Failed to refresh token, please check refresh_token'));
          this.status = 'Error';
          this.refreshDisplay();
        }
      } else {
        this.addLog(chalk.red(`Failed to fetch user info: ${error.message}`));
        this.status = 'Error';
        this.refreshDisplay();
      }
    }
  }

  async checkAndCompleteTasks() {
    if (this.banned) {
      this.addLog(chalk.red('Account is banned, skipping task completion'));
      return;
    }
    this.addLog(chalk.yellow('Checking for uncompleted tasks'));
    if (this.uncompletedTaskIds.length === 0) {
      this.addLog(chalk.cyanBright('No uncompleted tasks found'));
      return;
    }
    this.addLog(chalk.yellow(`Found ${this.uncompletedTaskIds.length} uncompleted Task`));
    let completedCount = 0;
    for (const taskId of this.uncompletedTaskIds) {
      const task = this.tasks.allTasks.find(t => t.id === taskId);
      const taskName = task ? task.task_name || 'Unknown Task' : 'Unknown Task';
      try {
        this.addLog(chalk.yellow(`Processing Task ${taskName}`));
        const payload = { "t_id": taskId };
        await axios.post('https://inymxsvpmkfwnlmowzpi.supabase.co/rest/v1/rpc/handle_task_reward', payload, {
          headers: this.getHeaders(),
          ...(this.proxy ? {
            httpsAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
            httpAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
          } : {}),
        });
        this.addLog(chalk.green(`Task ${taskName} Completed Successfully`));
        completedCount++;
        await this.fetchUserInfo();
        const delay = Math.floor(Math.random() * (30000 - 20000 + 1)) + 20000;
        this.addLog(chalk.yellow(`Waiting ${delay / 1000} seconds before next task`));
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        if (error.response && error.response.status === 401) {
          this.addLog(chalk.red(`Invalid token for task "${taskName}": Unauthorized (401), attempting to refresh token`));
          try {
            await this.refreshToken();
            await this.checkAndCompleteTasks();
            break;
          } catch (refreshError) {
            this.addLog(chalk.red(`Failed to refresh token for task "${taskName}"`));
          }
        } else {
          this.addLog(chalk.red(`Failed to complete task "${taskName}": ${error.message}`));
        }
      }
    }
    if (completedCount > 0) {
      this.addLog(chalk.green(`${completedCount} task completed successfully`));
    } else {
      this.addLog(chalk.yellow('No tasks were completed'));
    }
  }

  async startMining() {
    if (this.banned) {
      this.addLog(chalk.red('Account is banned, cannot start mining'));
      this.status = 'Banned';
      this.refreshDisplay();
      return;
    }
    if (this.userInfo.mining_active) {
      this.addLog(chalk.green('Mining is Already Active'));
      this.startMiningInterval();
      this.startCountdown();
      this.refreshDisplay();
      return;
    }
    this.addLog(chalk.yellow('Mining is not active, attempting to start'));
    try {
      const payload = { "t_x": null };
      await axios.post('https://inymxsvpmkfwnlmowzpi.supabase.co/rest/v1/rpc/set_mining_paramn', payload, {
        headers: this.getHeaders(),
        ...(this.proxy ? {
          httpsAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
          httpAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
        } : {}),
      });
      this.addLog(chalk.green('Mining started successfully'));
      this.userInfo.mining_active = true;
      this.status = 'Mining Active';
      this.userInfo.mining_started = new Date().toISOString();
      this.startMiningInterval();
      this.startCountdown();
      this.refreshDisplay();
    } catch (error) {
      if (error.response && error.response.status === 401) {
        this.addLog(chalk.red('Invalid token: Unauthorized (401), attempting to refresh token'));
        try {
          await this.refreshToken();
          await this.startMining();
        } catch (refreshError) {
          this.addLog(chalk.red('Failed to refresh token'));
          this.status = 'Error';
          this.refreshDisplay();
        }
      } else {
        this.addLog(chalk.red(`Failed to start mining: ${error.message}`));
        this.status = 'Error';
        this.refreshDisplay();
      }
    }
  }

  startMiningInterval() {
    if (this.miningInterval) clearInterval(this.miningInterval);
    this.miningInterval = setInterval(async () => {
      try {
        await axios.post('https://inymxsvpmkfwnlmowzpi.supabase.co/rest/v1/rpc/sync_mining', {}, {
          headers: this.getHeaders(),
          ...(this.proxy ? {
            httpsAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
            httpAgent: this.proxy.type === 'socks5' ? new SocksProxyAgent(this.proxy.url) : new HttpsProxyAgent(this.proxy.url),
          } : {}),
        });
        this.addLog(chalk.greenBright('Mining Synced Successfully'));
      } catch (error) {
        if (error.response && error.response.status === 401) {
          this.addLog(chalk.red('Invalid token: Unauthorized (401), attempting to refresh token'));
          try {
            await this.refreshToken();
          } catch (refreshError) {
            this.addLog(chalk.red('Failed to refresh token'));
            this.status = 'Error';
            this.refreshDisplay();
            clearInterval(this.miningInterval);
          }
        } else {
          this.addLog(chalk.red(`Failed to sync mining: ${error.message}`));
        }
      }
    }, 30000);
  }

  startCountdown() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = setInterval(async () => {
      if (this.userInfo.mining_active && !this.banned) {
        const miningStarted = new Date(this.userInfo.mining_started);
        const now = new Date();
        const elapsed = now - miningStarted;
        const remaining = 24 * 60 * 60 * 1000 - elapsed;
        if (remaining > 0) {
          this.nextMining = this.formatTime(remaining);
        } else {
          this.nextMining = 'Ready to mine again';
          this.status = 'Idle';
          this.userInfo.mining_active = false;
          if (this.miningInterval) clearInterval(this.miningInterval);
          this.addLog(chalk.yellow('Mining period completed, attempting to start mining again'));
          await this.startMining();
        }
        this.refreshDisplay();
      }
    }, 1000);
  }

  startUserInfoRefresh() {
    setInterval(() => {
      this.fetchUserInfo();
    }, 60 * 60 * 1000);
  }

  formatTime(millis) {
    const seconds = Math.floor(millis / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  }

  getRandomUserAgent() {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 OPR/119.0.0.0 (Edition cdf)',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  addLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${chalk.cyanBright(`[Account ${this.id}]`)} ${message.replace(/\{[^}]+\}/g, '')}`;
    this.logs.push(logMessage);
    if (this.logs.length > 100) this.logs.shift();
    if (this.logPane && this.isDisplayed) {
      this.logPane.setContent(this.logs.join('\n'));
      this.logPane.setScrollPerc(100);
      this.uiScreen.render();
    }
  }

  refreshDisplay() {
    if (!this.isDisplayed || !this.accountPane || !this.logPane) return;
    const statusColor = this.status === 'Mining Active' ? 'green' : this.status === 'Error' || this.status === 'Banned' ? 'red' : 'yellow';
    const bannedColor = this.banned ? 'red' : 'green';
    const info = `
 Wallet Address: {magenta-fg}${this.walletAddress}{/magenta-fg}
 Miner Points  : {green-fg}${this.minerPoints}{/green-fg}
 Total Points  : {green-fg}${this.totalPoints}{/green-fg}
 Status        : {${statusColor}-fg}${this.status}{/}
 Next Mining   : {yellow-fg}${this.nextMining}{/yellow-fg}
 Banned        : {${bannedColor}-fg}${this.banned ? 'Yes' : 'No'}{/}
 IP Address    : {cyan-fg}${this.ipAddress}{/cyan-fg}
 Proxy         : {cyan-fg}${this.proxy ? `${this.proxy.url}` : 'None'}{/cyan-fg}
    `;
    this.accountPane.setContent(info);
    this.logPane.setContent(this.logs.join('\n'));
    this.logPane.setScrollPerc(100);
    this.uiScreen.render();
  }

  static async loadTokens() {
    try {
      const filePath = path.join(__dirname, 'token.json');
      const data = await fs.readFile(filePath, 'utf8');
      const tokens = JSON.parse(data);
      if (!Array.isArray(tokens) || tokens.length === 0) {
        console.error('[ERROR] token.json is empty or invalid');
        return [];
      }
      WizoMiner.allTokens = tokens.map((tokenObj, index) => ({
        id: index + 1,
        token: tokenObj.token,
        refresh_token: tokenObj.refresh_token
      }));
      return WizoMiner.allTokens;
    } catch (error) {
      console.error(`[ERROR] Failed to load token.json: ${error.message}`);
      return [];
    }
  }

  static async saveTokens(tokens) {
    try {
      const filePath = path.join(__dirname, 'token.json');
      const data = tokens.map(t => ({ token: t.token, refresh_token: t.refresh_token }));
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`[ERROR] Failed to save token.json: ${error.message}`);
    }
  }

  static async loadProxies() {
    const proxies = [];
    try {
      const filePath = path.join(__dirname, 'proxy.txt');
      const data = await fs.readFile(filePath, 'utf8');
      const lines = data.split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');
      for (const line of lines) {
        const proxyRegex = /^(socks5|http|https):\/\/(?:([^:@]+):([^@]+)@)?([^:]+):(\d+)$/i;
        const match = line.match(proxyRegex);
        if (!match) {
          proxies.push({ error: `Invalid proxy format: ${line}. Expected 'socks5://[user:pass@]host:port' or 'http(s)://[user:pass@]host:port', skipping.` });
          continue;
        }
        const [, scheme, username, password, host, port] = match;
        const type = scheme.toLowerCase() === 'socks5' ? 'socks5' : 'http';
        const auth = username && password ? `${username}:${password}@` : '';
        const url = `${scheme}://${auth}${host}:${port}`;
        proxies.push({ type, url });
      }
      if (!proxies.filter(p => !p.error).length) {
        proxies.push({ error: 'No valid proxies found in proxy.txt. Running without proxy.' });
      }
      return proxies;
    } catch (error) {
      proxies.push({ error: `Failed to read proxy.txt: ${error.message}. Running without proxy.` });
      return proxies;
    }
  }
}

async function main() {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Wizo Auto Mining',
  });

  const headerPane = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 7,
    tags: true,
    align: 'left',
  });
  screen.append(headerPane);

  function renderBanner() {
    const threshold = 80;
    const margin = Math.max(screen.width - 80, 0);
    let art = "";
    if (screen.width >= threshold) {
      art = cfonts.render('NT EXHAUST', {
        font: 'block',
        align: 'center',
        colors: ['cyan', 'magenta'],
        background: 'transparent',
        letterSpacing: 1,
        lineHeight: 1,
        space: true,
        maxLength: screen.width - margin,
      }).string;
    } else {
      art = cfonts.render('NT EXHAUST', {
        font: 'tiny',
        align: 'center',
        colors: ['cyan', 'magenta'],
        background: 'transparent',
        letterSpacing: 1,
        lineHeight: 1,
        space: true,
        maxLength: screen.width - margin,
      }).string;
    }
    headerPane.setContent(art + '\n');
    headerPane.height = Math.min(8, art.split('\n').length + 2);
  }
  renderBanner();

  const channelPane2 = blessed.box({
    top: '28%',
    left: 2,
    width: '100%',
    height: 2,
    tags: false,
    align: 'center',
  });
  channelPane2.setContent('✪ BOT WIZO AUTO MINING ✪');
  screen.append(channelPane2);

  const infoPane = blessed.box({
    bottom: 0,
    left: 'center',
    width: '100%',
    height: 2,
    tags: true,
    align: 'center',
  });
  screen.append(infoPane);

  const dashTop = headerPane.height + channelPane2.height;
  const accountPane = blessed.box({
    top: dashTop,
    left: 0,
    width: '50%',
    height: '60%',
    border: { type: 'line' },
    label: ' User Info ',
    tags: true,
    style: { border: { fg: 'cyan' }, fg: 'white', bg: 'default' },
  });
  screen.append(accountPane);

  const logPane = blessed.log({
    top: dashTop,
    left: '50%',
    width: '50%',
    height: '60%',
    border: { type: 'line' },
    label: ' System Logs ',
    tags: true,
    style: { border: { fg: 'magenta' }, fg: 'white', bg: 'default' },
    scrollable: true,
    scrollbar: { bg: 'blue', fg: 'white' },
    alwaysScroll: true,
    mouse: true,
    keys: true,
  });
  screen.append(logPane);

  logPane.on('keypress', (ch, key) => {
    if (key.name === 'up') {
      logPane.scroll(-1);
      screen.render();
    } else if (key.name === 'down') {
      logPane.scroll(1);
      screen.render();
    } else if (key.name === 'pageup') {
      logPane.scroll(-10);
      screen.render();
    } else if (key.name === 'pagedown') {
      logPane.scroll(10);
      screen.render();
    }
  });

  logPane.on('mouse', (data) => {
    if (data.action === 'wheelup') {
      logPane.scroll(-2);
      screen.render();
    } else if (data.action === 'wheeldown') {
      logPane.scroll(2);
      screen.render();
    }
  });

  let tokens = await WizoMiner.loadTokens();
  let proxies = await WizoMiner.loadProxies();
  let activeIndex = 0;
  let miners = [];

  function updateMiners() {
    miners.forEach(miner => {
      if (miner.countdownInterval) clearInterval(miner.countdownInterval);
      if (miner.miningInterval) clearInterval(miner.miningInterval);
    });
    miners = tokens.map((tokenObj, idx) => {
      const proxyEntry = proxies[idx % proxies.length] || null;
      const proxy = proxyEntry && !proxyEntry.error ? { ...proxyEntry } : null;
      const miner = new WizoMiner(tokenObj.token, tokenObj.refresh_token, proxy, tokenObj.id);
      miner.uiScreen = screen;
      miner.accountPane = accountPane;
      miner.logPane = logPane;
      if (proxyEntry && proxyEntry.error) {
        miner.addLog(chalk.yellow(proxyEntry.error));
      }
      return miner;
    });

    if (miners.length > 0) {
      miners[activeIndex].isDisplayed = true;
      miners[activeIndex].addLog(chalk.magentaBright('Miner Initialized Successfully'));
      miners[activeIndex].refreshDisplay();
      miners.forEach(miner => miner.start());
    } else {
      logPane.setContent('No valid tokens found in token.json.\nPress \'q\' or Ctrl+C to exit.');
      accountPane.setContent('');
      screen.render();
    }
  }

  updateMiners();

  if (!miners.length) {
    screen.key(['escape', 'q', 'C-c'], () => {
      screen.destroy();
      process.exit(0);
    });
    screen.render();
    return;
  }

  infoPane.setContent(`Current Account: ${miners.length > 0 ? activeIndex + 1 : 0}/${miners.length} | Use Left/Right arrow keys to switch accounts.`);

  screen.key(['escape', 'q', 'C-c'], () => {
    miners.forEach(miner => {
      if (miner.countdownInterval) clearInterval(miner.countdownInterval);
      if (miner.miningInterval) clearInterval(miner.miningInterval);
      miner.addLog(chalk.yellow('Miner stopped'));
    });
    screen.destroy();
    process.exit(0);
  });

  screen.key(['right'], () => {
    if (miners.length === 0) return;
    miners[activeIndex].isDisplayed = false;
    activeIndex = (activeIndex + 1) % miners.length;
    miners[activeIndex].isDisplayed = true;
    miners[activeIndex].refreshDisplay();
    infoPane.setContent(`Current Account: ${activeIndex + 1}/${miners.length} | Use Left/Right arrow keys to switch accounts.`);
    screen.render();
  });

  screen.key(['left'], () => {
    if (miners.length === 0) return;
    miners[activeIndex].isDisplayed = false;
    activeIndex = (activeIndex - 1 + miners.length) % miners.length;
    miners[activeIndex].isDisplayed = true;
    miners[activeIndex].refreshDisplay();
    infoPane.setContent(`Current Account: ${activeIndex + 1}/${miners.length} | Use Left/Right arrow keys to switch accounts.`);
    screen.render();
  });

  screen.key(['tab'], () => {
    logPane.focus();
    screen.render();
  });

  screen.on('resize', () => {
    renderBanner();
    headerPane.width = '100%';
    channelPane2.top = headerPane.height;
    accountPane.top = dashTop;
    logPane.top = dashTop;
    screen.render();
  });

  screen.render();
}

main().catch(error => {
  console.error(`[ERROR] Failed to start: ${error.message}`);
  const screen = blessed.screen({ smartCSR: true, title: 'Wizo Miner' });
  const logPane = blessed.box({
    top: 'center',
    left: 'center',
    width: '80%',
    height: '100%',
    border: { type: 'line' },
    label: ' System Logs ',
    content: `Failed to start: ${error.message}\nPlease fix the issue and restart.\nPress 'q' or Ctrl+C to exit`,
    style: { border: { fg: 'red' }, fg: 'blue', bg: 'default' },
  });
  screen.append(logPane);
  screen.key(['escape', 'q', 'C-c'], () => {
    screen.destroy();
    process.exit(0);
  });
  screen.render();
});
