import { contextBridge, ipcRenderer } from 'electron';

export interface WorkflowAPI {
  start: (requirement: any) => Promise<any>;
  pause: (workflowId: string) => Promise<any>;
  resume: (workflowId: string) => Promise<any>;
  stop: (workflowId: string) => Promise<any>;
  getStatus: () => Promise<any>;
  getDocument: (docType: string, featureName: string) => Promise<any>;
  onProgress: (callback: (progress: any) => void) => () => void;
  onPhaseChange: (callback: (info: any) => void) => () => void;
  onError: (callback: (error: any) => void) => () => void;
  onLog: (callback: (log: any) => void) => () => void;
}

const workflowAPI: WorkflowAPI = {
  start: (requirement) => ipcRenderer.invoke('workflow:start', requirement),
  
  pause: (workflowId) => ipcRenderer.invoke('workflow:pause', workflowId),
  
  resume: (workflowId) => ipcRenderer.invoke('workflow:resume', workflowId),
  
  stop: (workflowId) => ipcRenderer.invoke('workflow:stop', workflowId),
  
  getStatus: () => ipcRenderer.invoke('workflow:getStatus'),
  
  getDocument: (docType, featureName) => 
    ipcRenderer.invoke('workflow:getDocument', docType, featureName),
  
  onProgress: (callback) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('workflow:progress', handler);
    return () => ipcRenderer.removeListener('workflow:progress', handler);
  },
  
  onPhaseChange: (callback) => {
    const handler = (_event: any, info: any) => callback(info);
    ipcRenderer.on('workflow:phaseChange', handler);
    return () => ipcRenderer.removeListener('workflow:phaseChange', handler);
  },
  
  onError: (callback) => {
    const handler = (_event: any, error: any) => callback(error);
    ipcRenderer.on('workflow:error', handler);
    return () => ipcRenderer.removeListener('workflow:error', handler);
  },
  
  onLog: (callback) => {
    const handler = (_event: any, log: any) => callback(log);
    ipcRenderer.on('workflow:log', handler);
    return () => ipcRenderer.removeListener('workflow:log', handler);
  }
};

export function exposeWorkflowAPI(): void {
  contextBridge.exposeInMainWorld('workflow', workflowAPI);
}
