import React, { useState } from 'react';
import { useOpenSpaceStore } from '../../stores/openspace-store';

const LANGUAGES: Array<{ id: 'lua' | 'javascript' | 'python'; label: string }> = [
  { id: 'lua', label: 'Lua' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
];

export function OpenSpaceScriptEditor() {
  const {
    currentScript, currentLanguage, scriptResult, scriptTemplates,
    setCurrentScript, setCurrentLanguage, executeScript, generateScript, getTemplates,
  } = useOpenSpaceStore();

  const [prompt, setPrompt] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const handleExecute = async () => {
    if (!currentScript.trim()) return;
    await executeScript(currentScript, currentLanguage);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    await generateScript(prompt, currentLanguage);
    setPrompt('');
  };

  const handleTemplateSelect = (tplId: string) => {
    setSelectedTemplate(tplId);
    const tpl = (scriptTemplates as any[]).find((t: any) => t.name === tplId);
    if (tpl?.scriptTemplate) {
      setCurrentScript(tpl.scriptTemplate);
      if (tpl.language) setCurrentLanguage(tpl.language);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-200">脚本编辑器</h2>
        <button
          onClick={() => getTemplates()}
          className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
        >
          加载模板
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-2">
        {/* Language + template selectors */}
        <div className="flex gap-2">
          <select
            value={currentLanguage}
            onChange={(e) => setCurrentLanguage(e.target.value as any)}
            className="rounded bg-gray-800 border border-gray-600 px-2 py-1 text-xs text-gray-200"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>

          <select
            value={selectedTemplate}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="flex-1 rounded bg-gray-800 border border-gray-600 px-2 py-1 text-xs text-gray-200"
          >
            <option value="">-- 选择模板 --</option>
            {(scriptTemplates as any[]).map((tpl: any) => (
              <option key={tpl.name} value={tpl.name}>
                {tpl.category ? `[${tpl.category}] ` : ''}{tpl.name}
              </option>
            ))}
          </select>
        </div>

        {/* AI prompt input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="用自然语言描述操作，AI 生成脚本..."
            className="flex-1 rounded bg-gray-800 border border-gray-600 px-2 py-1 text-xs text-gray-200 placeholder-gray-500"
          />
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim()}
            className="rounded bg-purple-600 px-3 py-1 text-xs text-white hover:bg-purple-500 disabled:opacity-50"
          >
            生成
          </button>
        </div>

        {/* Code editor (textarea fallback - Monaco would be integrated here) */}
        <textarea
          value={currentScript}
          onChange={(e) => setCurrentScript(e.target.value)}
          placeholder={`-- ${currentLanguage.toUpperCase()} script for OpenSpace...`}
          className="flex-1 min-h-[120px] resize-none rounded bg-gray-900 border border-gray-600 px-3 py-2 text-xs text-gray-200 font-mono placeholder-gray-600 focus:border-blue-500 focus:outline-none"
          spellCheck={false}
        />

        {/* Execute button */}
        <button
          onClick={handleExecute}
          disabled={!currentScript.trim()}
          className="w-full rounded bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          执行脚本
        </button>

        {/* Result display */}
        {scriptResult && (
          <div className={`rounded border px-3 py-2 text-xs ${
            scriptResult.success
              ? 'border-green-700/50 bg-green-900/20 text-green-300'
              : 'border-red-700/50 bg-red-900/20 text-red-300'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-medium">{scriptResult.success ? '✅ 成功' : '❌ 失败'}</span>
              <span className="text-gray-500">{scriptResult.duration}ms</span>
            </div>
            {scriptResult.error && (
              <p className="mt-1 text-red-400">{scriptResult.error}</p>
            )}
            {scriptResult.result !== undefined && (
              <pre className="mt-1 whitespace-pre-wrap text-gray-300">
                {typeof scriptResult.result === 'string' ? scriptResult.result : JSON.stringify(scriptResult.result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
