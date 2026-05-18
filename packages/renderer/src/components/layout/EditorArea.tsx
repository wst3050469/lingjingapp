import { Allotment } from 'allotment';
import { useUIStore } from '../../stores/ui-store';
import { EditorPane } from '../editor/EditorPane';
import { BottomPanel } from './BottomPanel';

export function EditorArea() {
  const { showBottomPanel } = useUIStore();

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <Allotment vertical proportionalLayout={false} className="flex-1">
        <Allotment.Pane minSize={100}>
          <EditorPane />
        </Allotment.Pane>
        {showBottomPanel && (
          <Allotment.Pane preferredSize={250} minSize={100} snap>
            <BottomPanel />
          </Allotment.Pane>
        )}
      </Allotment>
    </div>
  );
}
