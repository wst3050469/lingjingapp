// WikiPanel - top-level container for the Repo Wiki right panel

import { useEffect } from 'react';
import { Allotment } from 'allotment';
import { WikiToolbar } from './WikiToolbar';
import { WikiStatusBanner } from './WikiStatusBanner';
import { WikiTOC } from './WikiTOC';
import { WikiContentViewer } from './WikiContentViewer';
import { useWikiStore } from '../../stores/wiki-store';

export function WikiPanel() {
  const { loadStatus, loadToc, detectChanges } = useWikiStore();

  useEffect(() => {
    loadStatus();
    loadToc();
    detectChanges();

    // Watchdog: periodically check for repo changes (every 30 seconds)
    const watchdogTimer = setInterval(() => {
      detectChanges();
    }, 30000);

    return () => {
      clearInterval(watchdogTimer);
    };
  }, []);

  return (
    <div className="h-full flex flex-col bg-cp-bg border-l border-cp-border/40">
      {/* Toolbar */}
      <WikiToolbar />

      {/* Status / Progress Banner */}
      <WikiStatusBanner />

      {/* Main content: TOC + Viewer */}
      <div className="flex-1 overflow-hidden">
        <Allotment proportionalLayout={false}>
          <Allotment.Pane preferredSize={200} minSize={140} maxSize={350} snap>
            <WikiTOC />
          </Allotment.Pane>
          <Allotment.Pane minSize={200}>
            <WikiContentViewer />
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
}
