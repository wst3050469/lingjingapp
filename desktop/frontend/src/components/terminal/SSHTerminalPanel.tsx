import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useRemoteStore } from '../../stores/remote-store';

export function SSHTerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { activeTerminal, disconnect } = useRemoteStore();
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    if (!terminalRef.current || !activeTerminal) return;

    // Initialize xterm
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        selectionBackground: '#3a3d41',
      },
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Fit terminal to container
    const fitTerminal = () => {
      try {
        fitAddon.fit();
        const { cols, rows } = term;
        if (activeTerminal) {
          window.electronAPI.ssh.terminalResize(activeTerminal.sshTerminalId, cols, rows);
        }
      } catch (err) {
        // Fit may fail if terminal is not visible
      }
    };

    fitTerminal();

    // Handle resize
    const resizeObserver = new ResizeObserver(fitTerminal);
    resizeObserver.observe(terminalRef.current);

    term.onResize(({ cols, rows }) => {
      if (activeTerminal) {
        window.electronAPI.ssh.terminalResize(activeTerminal.sshTerminalId, cols, rows);
      }
    });

    // Send input to SSH
    term.onData((data) => {
      if (activeTerminal) {
        window.electronAPI.ssh.terminalInput(activeTerminal.sshTerminalId, data);
      }
    });

    // Listen for data from SSH
    const unsubscribeData = window.electronAPI.ssh.onTerminalData(({ sshTerminalId, data }) => {
      if (sshTerminalId === activeTerminal.sshTerminalId && term) {
        term.write(data);
      }
    });

    // Listen for terminal closed
    const unsubscribeClosed = window.electronAPI.ssh.onTerminalClosed(({ sshTerminalId }) => {
      if (sshTerminalId === activeTerminal.sshTerminalId) {
        setDisconnected(true);
        term.write('\r\n\r\n\x1b[31mSSH 连接已断开\x1b[0m\r\n');
      }
    });

    // Welcome message
    term.write(`\x1b[32m连接到 ${activeTerminal.username}@${activeTerminal.host}\x1b[0m\r\n`);

    return () => {
      resizeObserver.disconnect();
      unsubscribeData();
      unsubscribeClosed();
      term.dispose();
    };
  }, [activeTerminal]);

  const handleDisconnect = () => {
    disconnect();
  };

  const handleReconnect = () => {
    if (activeTerminal) {
      setDisconnected(false);
      // Reconnect would need to be implemented in the store
      window.location.reload(); // Simple workaround: reload to reconnect
    }
  };

  if (!activeTerminal) {
    return (
      <div className="h-full flex items-center justify-center bg-cp-bg">
        <p className="text-sm text-cp-text-dim">未连接到远程服务器</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-cp-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-cp-border bg-cp-activitybar shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${disconnected ? 'bg-red-400' : 'bg-green-400'}`} />
          <span className="text-xs text-cp-text">
            {activeTerminal.name} ({activeTerminal.username}@{activeTerminal.host})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {disconnected ? (
            <>
              <button
                onClick={handleReconnect}
                className="text-xs px-2 py-0.5 rounded bg-cp-accent text-white hover:bg-cp-accent/80 transition-colors"
              >
                重连
              </button>
              <button
                onClick={handleDisconnect}
                className="text-xs px-2 py-0.5 rounded bg-white/5 text-cp-text-dim hover:text-white transition-colors"
              >
                关闭
              </button>
            </>
          ) : (
            <button
              onClick={handleDisconnect}
              className="text-xs px-2 py-0.5 rounded bg-white/5 text-cp-text-dim hover:text-white transition-colors"
              title="断开连接"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Terminal */}
      <div ref={terminalRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
