// SSH connection persistence - reads/writes from config.json

import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { SSHConnection, SSHConnectionForm } from './types.js';
import { encryptCredential, decryptCredential } from './crypto.js';

const CONFIG_PATH = join(homedir(), '.lingjing', 'config.json');

interface LingjingConfig {
  'remote.connections'?: SSHConnection[];
  [key: string]: any;
}

async function loadConfigFile(): Promise<LingjingConfig> {
  try {
    if (!existsSync(CONFIG_PATH)) {
      return {};
    }
    const raw = await readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveConfigFile(config: LingjingConfig): Promise<void> {
  const configDir = dirname(CONFIG_PATH);
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true });
  }
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function loadConnections(): Promise<SSHConnection[]> {
  const config = await loadConfigFile();
  return config['remote.connections'] || [];
}

export async function saveConnection(form: SSHConnectionForm): Promise<SSHConnection> {
  const connections = await loadConnections();
  
  const isNew = !form.id;
  const connectionId = form.id || `ssh-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  
  // Build connection object
  const connection: SSHConnection = {
    id: connectionId,
    name: form.name,
    host: form.host,
    port: form.port,
    username: form.username,
    authMethod: form.authMethod,
    status: 'disconnected',
  };
  
  // Encrypt sensitive credentials
  if (form.authMethod === 'password' && form.password) {
    connection.passwordEncrypted = encryptCredential(form.password);
  } else if (form.authMethod === 'privateKey' && form.privateKey) {
    connection.privateKeyEncrypted = encryptCredential(form.privateKey);
  }
  
  // If editing, preserve existing encrypted credentials if not changed
  if (!isNew) {
    const existing = connections.find(c => c.id === form.id);
    if (existing) {
      if (form.authMethod === 'password' && !form.password && existing.passwordEncrypted) {
        connection.passwordEncrypted = existing.passwordEncrypted;
      }
      if (form.authMethod === 'privateKey' && !form.privateKey && existing.privateKeyEncrypted) {
        connection.privateKeyEncrypted = existing.privateKeyEncrypted;
      }
    }
  }
  
  // Update or add
  const index = connections.findIndex(c => c.id === connectionId);
  if (index >= 0) {
    connections[index] = connection;
  } else {
    connections.push(connection);
  }
  
  // Save to config
  const config = await loadConfigFile();
  config['remote.connections'] = connections;
  await saveConfigFile(config);
  
  // Return connection without encrypted credentials
  const { passwordEncrypted: _, privateKeyEncrypted: __, ...sanitized } = connection;
  return sanitized as SSHConnection;
}

export async function deleteConnection(id: string): Promise<void> {
  const connections = await loadConnections();
  const filtered = connections.filter(c => c.id !== id);
  
  const config = await loadConfigFile();
  config['remote.connections'] = filtered;
  await saveConfigFile(config);
}

export async function getConnectionWithCredentials(id: string): Promise<SSHConnection | null> {
  const connections = await loadConnections();
  const connection = connections.find(c => c.id === id);
  return connection || null;
}

export async function updateConnectionStatus(id: string, status: 'connected' | 'disconnected' | 'connecting'): Promise<void> {
  const connections = await loadConnections();
  const connection = connections.find(c => c.id === id);
  if (connection) {
    connection.status = status;
    
    const config = await loadConfigFile();
    config['remote.connections'] = connections;
    await saveConfigFile(config);
  }
}
