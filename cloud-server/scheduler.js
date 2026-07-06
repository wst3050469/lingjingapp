import { EventEmitter } from 'node:events';

export class CloudScheduler extends EventEmitter {
  constructor() {
    super();
    this.tasks = [];
  }
  start() { console.log('[scheduler] stub started'); }
  stop() { console.log('[scheduler] stub stopped'); }
  createSchedule(opts) { return { id: 'stub-' + Date.now(), ...opts }; }
  deleteSchedule(id) { return true; }
  getSchedule(id) { return null; }
  listSchedules(status) { return []; }
  getLogs(opts) { return []; }
  updateSchedule(id, opts) { return { id, ...opts }; }
  triggerNow(id) { return { success: true }; }
}
