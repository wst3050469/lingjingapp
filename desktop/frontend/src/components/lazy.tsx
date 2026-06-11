import { lazy, Suspense, ComponentType } from 'react';

function createLazyComponent<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T } | T>,
  componentName: string,
  resolveDefault: boolean = true
) {
  const LazyComponent = lazy(resolveDefault
    ? () => importFn().then(m => ({ default: ('default' in m ? (m as any).default : m) as T }))
    : importFn as any);
  
  const Component = (props: any) => (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full w-full bg-neutral-900">
          <div className="flex flex-col items-center gap-3">
            <svg
              className="animate-spin h-8 w-8 text-primary-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm text-neutral-400">Loading {componentName}...</span>
          </div>
        </div>
      }
    >
      <LazyComponent {...props} />
    </Suspense>
  );
  
  Component.displayName = `Lazy(${componentName})`;
  return Component;
}

export const LazyChatPanel = createLazyComponent(
  () => import('./chat/ChatPanel').then(m => ({ default: m.ChatPanel as any })),
  'ChatPanel',
  false
);

export const LazyQuestView = createLazyComponent(
  () => import('./quest/QuestView').then(m => ({ default: m.QuestView as any })),
  'QuestView',
  false
);

export const LazyWikiPanel = createLazyComponent(
  () => import('./wiki/WikiPanel').then(m => ({ default: m.WikiPanel as any })),
  'WikiPanel',
  false
);

export const LazySettingsModal = createLazyComponent(
  () => import('./settings/SettingsModal').then(m => ({ default: m.SettingsModal as any })),
  'SettingsModal',
  false
);

export const LazyExpertCanvasModal = createLazyComponent(
  () => import('./chat/ExpertCanvasModal').then(m => ({ default: m.ExpertCanvasModal as any })),
  'ExpertCanvasModal',
  false
);

export const LazySSHConnectionDialog = createLazyComponent(
  () => import('./remote/SSHConnectionDialog').then(m => ({ default: m.SSHConnectionDialog as any })),
  'SSHConnectionDialog',
  false
);
