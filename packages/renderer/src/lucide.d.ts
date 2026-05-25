// lucide-react v1.16.0 类型适配
// lucide-react v1.x 的图标类型为 ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>
// 但在 TypeScript 5.9 + React 18 类型下，该类型在 JSX 上下文中不被识别为有效组件
// 这里使用 FC 重新声明项目中使用的图标，确保 JSX 兼容性

import type { FC, SVGProps } from 'react';

export interface LucideProps extends Partial<SVGProps<SVGSVGElement>> {
  size?: string | number;
  absoluteStrokeWidth?: boolean;
}

// 保持与 lucide-react 的 LucideIcon 类型兼容
export type LucideIcon = FC<LucideProps>;

// 模块增强：覆盖项目中使用的图标类型为 FC 版本
declare module 'lucide-react' {
  export const GitBranch: FC<LucideProps>;
  export const RefreshCw: FC<LucideProps>;
  export const LogOut: FC<LucideProps>;
  export const Check: FC<LucideProps>;
  export const Plus: FC<LucideProps>;
  export const AlertTriangle: FC<LucideProps>;
  export const X: FC<LucideProps>;
  export const ArrowRight: FC<LucideProps>;
  export const ExternalLink: FC<LucideProps>;
  export const Shield: FC<LucideProps>;
  export const Star: FC<LucideProps>;
  export const History: FC<LucideProps>;
}
