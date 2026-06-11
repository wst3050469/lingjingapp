import React from 'react';

interface TriggerConfigProps {
  triggers: any[];
  onChange?: (triggers: any[]) => void;
}

export const TriggerConfig: React.FC<TriggerConfigProps> = ({ triggers, onChange }) => {
  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-400 font-medium">触发器配置</label>
      {(triggers || []).map((trigger, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-gray-300 bg-gray-800/50 rounded px-2 py-1.5">
          {trigger.type === 'manual' && <span className="text-green-400">手动触发</span>}
          {trigger.type === 'push' && (
            <>
              <span className="text-yellow-400">Push</span>
              <span className="text-gray-500">{(trigger.branches || []).join(', ')}</span>
            </>
          )}
          {trigger.type === 'cron' && (
            <>
              <span className="text-purple-400">定时</span>
              <code className="text-gray-500 font-mono">{trigger.expression}</code>
            </>
          )}
        </div>
      ))}
    </div>
  );
};
