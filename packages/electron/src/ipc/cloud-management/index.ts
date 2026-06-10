export { registerUserIpc } from './user-ipc.js';
export { registerDeviceIpc } from './device-ipc.js';
export { registerSubscriptionIpc } from './subscription-ipc.js';
export { registerSyncIpc } from './sync-ipc.js';
export { registerStorageIpc } from './storage-ipc.js';
export { registerApiKeyIpc } from './api-key-ipc.js';

export function registerAllCloudManagementIpc(): void {
  const { registerUserIpc } = require('./user-ipc.js');
  const { registerDeviceIpc } = require('./device-ipc.js');
  const { registerSubscriptionIpc } = require('./subscription-ipc.js');
  const { registerSyncIpc } = require('./sync-ipc.js');
  const { registerStorageIpc } = require('./storage-ipc.js');
  const { registerApiKeyIpc } = require('./api-key-ipc.js');
  
  registerUserIpc();
  registerDeviceIpc();
  registerSubscriptionIpc();
  registerSyncIpc();
  registerStorageIpc();
  registerApiKeyIpc();
}
