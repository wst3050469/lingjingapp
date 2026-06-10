import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // BUG-016: Use ref instead of state to avoid closure traps in useEffect cleanup
  const terminalIdRef = useRef<string | null>(null);
  const [, setRenderKey] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      fontSize: 13,
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#aeafad',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    // Delay fit to ensure container has dimensions
    requestAnimationFrame(() => {
      try { fitAddon.fit(); } catch {}
    });

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Create terminal session on main process
    window.electronAPI.terminal.create().then((result: { terminalId: string }) => {
      // BUG-016: Store in ref for cleanup, not state (avoids stale closure)
      terminalIdRef.current = result.terminalId;
      setRenderKey(k => k + 1); // trigger re-render for UI

      // Forward user input to main process
      term.onData((data: string) => {
        window.electronAPI.terminal.input(result.terminalId, data);
      });
    });

    // Listen for output from main process
    const unsub = window.electronAPI.terminal.onData((event: { terminalId: string; data: string }) => {
      term.write(event.data);
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {}
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      unsub();
      term.dispose();
      // BUG-016: Use ref value which is always current
      const tid = terminalIdRef.current;
      if (tid) {
        window.electronAPI.terminal.destroy(tid);
        terminalIdRef.current = null;
      }
    };
  }, []);

  return (
    <div className="h-full flex flex-col bg-cp-bg">
      {/* Terminal header */}
      <div className="flex items-center px-3 py-1 border-b border-cp-border bg-cp-sidebar">
        <span className="text-xs font-semibold uppercase tracking-wide text-cp-text-dim">Terminal</span>
        <div className="flex-1" />
        <button
          className="text-cp-text-dim hover:text-cp-text text-xs px-2 py-0.5 rounded hover:bg-white/10"
          onClick={() => {
            // Create new terminal session
            if (termRef.current) {
              const oldTid = terminalIdRef.current;
              if (oldTid) {
                window.electronAPI.terminal.destroy(oldTid);
              }
              termRef.current.clear();
              window.electronAPI.terminal.create().then((result: { terminalId: string }) => {
                terminalIdRef.current = result.terminalId;
                setRenderKey(k => k + 1);
                termRef.current?.onData((data: string) => {
                  window.electronAPI.terminal.input(result.terminalId, data);
                });
              });
            }
          }}
        >
          + New
        </button>
      </div>
      {/* Terminal content */}
      <div ref={containerRef} className="flex-1 p-1" />
    </div>
  );
}
