// Quest Artifacts - right column with tabbed panels

import { useQuestStore, type ArtifactTab } from '../../stores/quest-store';
import { QuestSpecTab } from './QuestSpecTab';
import { QuestChangedFilesTab } from './QuestChangedFilesTab';
import { QuestPreviewTab } from './QuestPreviewTab';
import { useQuestDiffStore } from '../../stores/quest-diff-store';

const TABS: { key: ArtifactTab; label: string }[] = [
  { key: 'spec', label: 'Spec' },
  { key: 'files', label: 'Changed Files' },
  { key: 'preview', label: 'Preview' },
];

export function QuestArtifacts() {
  const { activeArtifactTab, setActiveArtifactTab } = useQuestStore();
  const fileCount = Object.keys(useQuestDiffStore((s) => s.fileChanges)).length;

  return (
    <div className="h-full flex flex-col bg-cp-bg border-l border-cp-border/30">
      {/* Tab bar */}
      <div className="flex items-center border-b border-cp-border/30 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveArtifactTab(tab.key)}
            className={`px-3 py-2 text-[11px] transition-colors relative ${
              activeArtifactTab === tab.key
                ? 'text-cp-text'
                : 'text-white/70 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.key === 'files' && fileCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-cp-accent/20 text-cp-accent text-[9px]">
                {fileCount}
              </span>
            )}
            {activeArtifactTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-cp-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeArtifactTab === 'spec' && <QuestSpecTab />}
        {activeArtifactTab === 'files' && <QuestChangedFilesTab />}
        {activeArtifactTab === 'preview' && <QuestPreviewTab />}
      </div>
    </div>
  );
}
