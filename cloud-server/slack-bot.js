export class SlackBot {
  constructor() {}
  async sendMessage(channel, text) { return { ok: true }; }
  async sendNotification(channel, text) { return { ok: true }; }
  verifySignature(req) { return true; }
  handleEvent(event) { return { ok: true }; }
  _handleCommand(cmd) { return { text: 'stub' }; }
  _handleInteractive(payload) { return { ok: true }; }
}
export function createSlackBot() { return new SlackBot(); }
