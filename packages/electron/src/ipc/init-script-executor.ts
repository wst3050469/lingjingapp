import { spawn } from 'node:child_process';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

export interface WorktreeInitConfig {
  npmInstall: boolean;
  envFileSource?: string;
  commands: string[];
  onFailure: 'continue' | 'abort';
}

export interface ScriptLog {
  step: string;
  stream: 'stdout' | 'stderr';
  text: string;
  timestamp: string;
}

export interface ScriptExecutionResult {
  success: boolean;
  failedStep?: string;
  logs: ScriptLog[];
}

const CONFIG_PATH = join(homedir(), '.lingjing', 'worktree-init-config.json');

const defaultConfig: WorktreeInitConfig = {
  npmInstall: true,
  commands: [],
  onFailure: 'abort',
};

export function loadWorktreeInitConfig(): WorktreeInitConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      return { ...defaultConfig, ...JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) };
    }
  } catch { /* ignore */ }
  return { ...defaultConfig };
}

export function saveWorktreeInitConfig(config: WorktreeInitConfig): void {
  const dir = join(homedir(), '.lingjing');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

export async function executeInitScripts(
  worktreePath: string,
  config: WorktreeInitConfig,
  onLog: (log: ScriptLog) => void,
): Promise<ScriptExecutionResult> {
  const logs: ScriptLog[] = [];
  const addLog = (step: string, stream: 'stdout' | 'stderr', text: string) => {
    const log: ScriptLog = { step, stream, text, timestamp: new Date().toISOString() };
    logs.push(log);
    onLog(log);
  };

  if (config.npmInstall) {
    const result = await runCommand('npm-install', 'npm', ['install'], worktreePath, addLog);
    if (!result) {
      if (config.onFailure === 'abort') {
        return { success: false, failedStep: 'npm-install', logs };
      }
    }
  }

  if (config.envFileSource) {
    const envTarget = join(worktreePath, '.env');
    if (existsSync(config.envFileSource)) {
      try {
        await copyFile(config.envFileSource, envTarget);
        addLog('env-copy', 'stdout', `Copied ${config.envFileSource} to ${envTarget}`);
      } catch (err) {
        addLog('env-copy', 'stderr', `Failed to copy .env: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      addLog('env-copy', 'stderr', `Source .env file not found: ${config.envFileSource}, skipping`);
    }
  }

  for (let i = 0; i < config.commands.length; i++) {
    const cmd = config.commands[i];
    const stepName = `custom-${i + 1}`;
    const result = await runCommand(stepName, cmd, [], worktreePath, addLog, true);
    if (!result) {
      if (config.onFailure === 'abort') {
        return { success: false, failedStep: stepName, logs };
      }
    }
  }

  return { success: true, logs };
}

function runCommand(
  step: string,
  command: string,
  args: string[],
  cwd: string,
  addLog: (step: string, stream: 'stdout' | 'stderr', text: string) => void,
  useShell: boolean = false,
): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd,
      shell: useShell || process.platform === 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdout?.on('data', (data: Buffer) => {
      addLog(step, 'stdout', data.toString().trim());
    });

    proc.stderr?.on('data', (data: Buffer) => {
      addLog(step, 'stderr', data.toString().trim());
    });

    proc.on('error', (err) => {
      addLog(step, 'stderr', `Process error: ${err.message}`);
      resolve(false);
    });

    proc.on('exit', (code) => {
      if (code !== 0) {
        addLog(step, 'stderr', `Process exited with code ${code}`);
        resolve(false);
      } else {
        addLog(step, 'stdout', 'Completed successfully');
        resolve(true);
      }
    });
  });
}
