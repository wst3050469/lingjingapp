import { createLogger } from '../monitoring/logger';
import { exec } from 'child_process';

const logger = createLogger('cli-dependency-detector');

export async function detectCliAvailability(command: string, versionRange: string): Promise<import('@codepilot/core/hw-skill/types').CliAvailabilityResult> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ command, available: false, installGuide: `Install ${command} and ensure it is in PATH` });
    }, 5000);

    exec(`${command} --version`, { timeout: 4000 }, (err, stdout) => {
      clearTimeout(timeout);
      if (err) {
        logger.debug('CLI not found', { command, error: err.message });
        resolve({ command, available: false, installGuide: `Install ${command} and ensure it is in PATH` });
        return;
      }
      const version = parseVersion(stdout.trim());
      const compatible = checkVersionRange(version, versionRange);
      logger.info('CLI detected', { command, version, compatible });
      resolve({ command, available: true, version, compatible, installGuide: compatible ? undefined : `Required ${versionRange}, found ${version}` });
    });
  });
}

export function parseVersion(output: string): string {
  const match = output.match(/(\d+\.\d+(?:\.\d+)?)/);
  return match ? match[1] : output.trim();
}

export function checkVersionRange(version: string, range: string): boolean {
  const v = version.split('.').map(Number);
  const rangeMatch = range.match(/>=?([\d.]+)\s*<?([\d.]*)/);
  if (!rangeMatch) return true;

  const min = rangeMatch[1].split('.').map(Number);
  const max = rangeMatch[2] ? rangeMatch[2].split('.').map(Number) : null;

  if (compareVersions(v, min) < 0) return false;
  if (max && compareVersions(v, max) >= 0) return false;
  return true;
}

function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

export async function detectKicad(): Promise<import('@codepilot/core/hw-skill/types').CliAvailabilityResult> {
  return detectCliAvailability('kicad-cli', '>=7.0.0 <9.0.0');
}

export async function detectOpenscad(): Promise<import('@codepilot/core/hw-skill/types').CliAvailabilityResult> {
  return detectCliAvailability('openscad', '>=2021.01');
}