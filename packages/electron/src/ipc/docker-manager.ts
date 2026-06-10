// Docker Remote Manager - creates and manages Docker containers for isolated quest execution
// Requires Docker to be installed and running on the host machine

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface DockerContainerInfo {
  containerId: string;
  taskId: string;
  port?: number;
}

const QUEST_IMAGE = 'node:20-slim';
const CONTAINER_WORKDIR = '/workspace';

/**
 * Check if Docker is available on the system.
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    await execFileAsync('docker', ['info'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create and start a Docker container for a quest task.
 * Mounts the workspace directory into the container.
 */
export async function createContainer(
  workspacePath: string,
  taskId: string,
  options?: { image?: string; port?: number; memory?: string; cpus?: string }
): Promise<DockerContainerInfo> {
  const image = options?.image || QUEST_IMAGE;
  const containerName = `quest-${taskId.replace(/[^a-zA-Z0-9-]/g, '-')}`;

  // Pull image if not available locally
  try {
    await execFileAsync('docker', ['image', 'inspect', image], { timeout: 10000 });
  } catch {
    await execFileAsync('docker', ['pull', image], { timeout: 120000 });
  }

  // BUG-019: Resource limits to prevent container from exhausting host resources
  const memoryLimit = options?.memory || '2g';
  const cpuLimit = options?.cpus || '2';

  // Build docker run args
  const args = [
    'run', '-d',
    '--name', containerName,
    '--memory', memoryLimit,
    '--cpus', cpuLimit,
    '--memory-swap', memoryLimit, // Prevent swap abuse
    '-v', `${workspacePath}:${CONTAINER_WORKDIR}`,
    '-w', CONTAINER_WORKDIR,
    '--label', `quest-task=${taskId}`,
  ];

  // Map a port if requested (for preview)
  if (options?.port) {
    args.push('-p', `${options.port}:${options.port}`);
  }

  // Keep container running with a long sleep
  args.push(image, 'sleep', 'infinity');

  const { stdout } = await execFileAsync('docker', args, { timeout: 30000 });
  const containerId = stdout.trim().slice(0, 12);

  // Install basic dev tools inside the container
  try {
    await execFileAsync('docker', ['exec', containerId, 'apt-get', 'update', '-qq'], { timeout: 60000 });
    await execFileAsync('docker', ['exec', containerId, 'apt-get', 'install', '-y', '-qq', 'git', 'curl'], { timeout: 60000 });
  } catch {
    // Non-critical - container still works without extra tools
  }

  return {
    containerId,
    taskId,
    port: options?.port,
  };
}

/**
 * Execute a command inside a running container.
 */
export async function execInContainer(
  containerId: string,
  command: string[],
  options?: { timeout?: number; cwd?: string }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ['exec'];
  if (options?.cwd) {
    args.push('-w', options.cwd);
  }
  args.push(containerId, ...command);

  try {
    const { stdout, stderr } = await execFileAsync('docker', args, {
      timeout: options?.timeout || 30000,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      exitCode: error.code || 1,
    };
  }
}

/**
 * Stop and remove a container.
 */
export async function removeContainer(containerId: string): Promise<void> {
  try {
    await execFileAsync('docker', ['rm', '-f', containerId], { timeout: 10000 });
  } catch {
    // Container may already be removed
  }
}

/**
 * Stop and remove all quest-related containers.
 */
export async function cleanupAllContainers(): Promise<void> {
  try {
    const { stdout } = await execFileAsync(
      'docker',
      ['ps', '-a', '--filter', 'label=quest-task', '--format', '{{.ID}}'],
      { timeout: 5000 }
    );

    const ids = stdout.trim().split('\n').filter(Boolean);
    for (const id of ids) {
      await removeContainer(id);
    }
  } catch {
    // ignore
  }
}

/**
 * List running quest containers.
 */
export async function listContainers(): Promise<DockerContainerInfo[]> {
  try {
    const { stdout } = await execFileAsync(
      'docker',
      ['ps', '--filter', 'label=quest-task', '--format', '{{.ID}}|{{.Labels}}'],
      { timeout: 5000 }
    );

    return stdout.trim().split('\n').filter(Boolean).map((line) => {
      const [id, labels] = line.split('|');
      const taskMatch = (labels || '').match(/quest-task=([^\s,]+)/);
      return {
        containerId: id,
        taskId: taskMatch ? taskMatch[1] : 'unknown',
      };
    });
  } catch {
    return [];
  }
}

/**
 * Copy files from container to host.
 */
export async function copyFromContainer(
  containerId: string,
  containerPath: string,
  hostPath: string
): Promise<void> {
  await execFileAsync('docker', ['cp', `${containerId}:${containerPath}`, hostPath], { timeout: 30000 });
}

/**
 * Copy files from host to container.
 */
export async function copyToContainer(
  containerId: string,
  hostPath: string,
  containerPath: string
): Promise<void> {
  await execFileAsync('docker', ['cp', hostPath, `${containerId}:${containerPath}`], { timeout: 30000 });
}
