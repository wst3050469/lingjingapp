// SSH module barrel export

export { registerSshIpc, destroyAllSshSessions } from './ssh-ipc.js';
export { loadConnections, saveConnection, deleteConnection, getConnectionWithCredentials, updateConnectionStatus } from './connection-store.js';
export { encryptCredential, decryptCredential, isSafeStorageAvailable } from './crypto.js';
export type { SSHConnection, SSHConnectionForm, SSHSession, SSHTerminalSession } from './types.js';
