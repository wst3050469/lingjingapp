// Network diagnostics IPC handlers - DNS / HTTP / Ping / Marketplace checks

import { ipcMain } from 'electron';
import https from 'node:https';
import http from 'node:http';
import dns from 'node:dns/promises';
import { exec } from 'node:child_process';

interface DiagResult {
  name: string;
  ok: boolean;
  latency: number; // ms
  detail: string;
}

function httpCheck(url: string, timeoutMs = 10000): Promise<{ status: number; latency: number }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: 'HEAD', timeout: timeoutMs }, (res) => {
      res.resume();
      resolve({ status: res.statusCode || 0, latency: Date.now() - start });
    });
    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

function pingHost(host: string): Promise<{ ok: boolean; latency: number; detail: string }> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const cmd = isWin ? `ping -n 1 -w 5000 ${host}` : `ping -c 1 -W 5 ${host}`;
    const start = Date.now();
    exec(cmd, { timeout: 10000 }, (err, stdout) => {
      const elapsed = Date.now() - start;
      if (err) {
        resolve({ ok: false, latency: elapsed, detail: `Ping failed: ${err.message}` });
        return;
      }
      // Extract latency from ping output
      const match = stdout.match(/[=<](\d+(?:\.\d+)?)\s*ms/);
      const latency = match ? parseFloat(match[1]) : elapsed;
      resolve({ ok: true, latency, detail: stdout.trim().split('\n').slice(-1)[0] || 'OK' });
    });
  });
}

export function registerNetworkIpc(): void {
  // Run full diagnostics - returns an array of results streamed as they complete
  ipcMain.handle('network:diagnose', async () => {
    const results: DiagResult[] = [];
    const logs: string[] = [];

    // 1. DNS check (GitHub + Cloud server)
    const dnsTargets = ['api.github.com', 'ide.zhejiangjinmo.com'];
    for (const dnsTarget of dnsTargets) {
      logs.push(`[DNS] Resolving ${dnsTarget} ...`);
      try {
        const start = Date.now();
        const addresses = await dns.resolve4(dnsTarget);
        const latency = Date.now() - start;
        const detail = `Resolved to ${addresses.join(', ')} in ${latency}ms`;
        logs.push(`[DNS] ${detail}`);
        results.push({ name: `DNS(${dnsTarget})`, ok: true, latency, detail });
      } catch (err: any) {
        const detail = `DNS resolution failed: ${err.message}`;
        logs.push(`[DNS] ${detail}`);
        results.push({ name: `DNS(${dnsTarget})`, ok: false, latency: 0, detail });
      }
    }

    // 2. HTTP check
    logs.push('[HTTP] Checking https://httpbin.org/status/200 ...');
    try {
      const { status, latency } = await httpCheck('https://httpbin.org/status/200');
      const ok = status >= 200 && status < 400;
      const detail = `HTTP ${status} in ${latency}ms`;
      logs.push(`[HTTP] ${detail}`);
      results.push({ name: 'HTTP', ok, latency, detail });
    } catch (err: any) {
      const detail = `HTTP check failed: ${err.message}`;
      logs.push(`[HTTP] ${detail}`);
      results.push({ name: 'HTTP', ok: false, latency: 0, detail });
    }

    // 3. Ping check
    logs.push('[Ping] Pinging 8.8.8.8 ...');
    try {
      const pingResult = await pingHost('8.8.8.8');
      logs.push(`[Ping] ${pingResult.detail}`);
      results.push({ name: 'Ping', ok: pingResult.ok, latency: pingResult.latency, detail: pingResult.detail });
    } catch (err: any) {
      const detail = `Ping failed: ${err.message}`;
      logs.push(`[Ping] ${detail}`);
      results.push({ name: 'Ping', ok: false, latency: 0, detail });
    }

    // 4. Marketplace check (simulate checking a marketplace/registry endpoint)
    logs.push('[Marketplace] Checking https://registry.npmmirror.com/ ...');
    try {
      const { status, latency } = await httpCheck('https://registry.npmmirror.com/');
      const ok = status >= 200 && status < 400;
      const detail = `Marketplace HTTP ${status} in ${latency}ms`;
      logs.push(`[Marketplace] ${detail}`);
      results.push({ name: 'Marketplace', ok, latency, detail });
    } catch (err: any) {
      const detail = `Marketplace check failed: ${err.message}`;
      logs.push(`[Marketplace] ${detail}`);
      results.push({ name: 'Marketplace', ok: false, latency: 0, detail });
    }

    return { results, logs };
  });
}
