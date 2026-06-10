/**
 * React 19 JSX compat shim for @monaco-editor/react.
 *
 * @monaco-editor/react@4.x was compiled with React 18 types where ReactNode
 * does not include `bigint`. React 19's @types/react adds bigint,
 * causing TS2786 "cannot be used as a JSX component".
 */
declare module '@monaco-editor/react' {
  import type { FC, ReactNode } from 'react';
  import type { editor } from 'monaco-editor';

  export type Theme = 'vs-dark' | 'light' | 'hc-black' | 'hc-light';

  export interface EditorProps {
    defaultValue?: string;
    defaultLanguage?: string;
    defaultPath?: string;
    value?: string;
    language?: string;
    path?: string;
    theme?: string | Theme;
    line?: number;
    loading?: ReactNode;
    options?: editor.IStandaloneEditorConstructionOptions;
    overrideServices?: editor.IEditorOverrideServices;
    saveViewState?: boolean;
    keepCurrentModel?: boolean;
    width?: string | number;
    height?: string | number;
    className?: string;
    wrapperProps?: object;
    beforeMount?: (monaco: any) => void;
    onMount?: (editor: editor.IStandaloneCodeEditor, monaco: any) => void;
    onChange?: (value: string | undefined, ev: editor.IModelContentChangedEvent) => void;
    onValidate?: (markers: editor.IMarker[]) => void;
  }

  export interface DiffEditorProps {
    original?: string;
    modified?: string;
    language?: string;
    originalLanguage?: string;
    modifiedLanguage?: string;
    originalModelPath?: string;
    modifiedModelPath?: string;
    keepCurrentOriginalModel?: boolean;
    keepCurrentModifiedModel?: boolean;
    theme?: string | Theme;
    loading?: ReactNode;
    options?: editor.IDiffEditorConstructionOptions;
    height?: string | number;
    width?: string | number;
    className?: string;
    wrapperProps?: object;
    beforeMount?: (monaco: any) => void;
    onMount?: (editor: editor.IStandaloneDiffEditor, monaco: any) => void;
  }

  const Editor: FC<EditorProps>;
  const DiffEditor: FC<DiffEditorProps>;
  const _default: FC<EditorProps>;
  function useMonaco(): any | null;
  // Monaco is both a type (namespace) and a value (the monaco-editor module)
  type Monaco = any;
  const Monaco: Monaco;

  export { Editor, DiffEditor, _default as default, useMonaco, Monaco };
}
