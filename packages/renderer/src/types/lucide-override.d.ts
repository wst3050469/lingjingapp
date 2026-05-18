// lucide-react 图标组件类型兼容性修复
// 根因：React 19 与 lucide-react 使用的 React 18 类型在 ForwardRefExoticComponent 上不兼容
// 修复：使用全局类型扩展使 lucide-react 图标类型兼容 React 19 JSX

import React from 'react';

// 扩展 JSX 类型以兼容 lucide-react 的 ForwardRefExoticComponent
declare global {
  namespace JSX {
    interface IntrinsicElements {
      // 保留原有声明
      [elemName: string]: any;
    }
  }
}

// 声明 lucide-react 图标为简单的函数组件
declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';
  
  export interface LucideProps extends SVGProps<SVGSVGElement> {
    size?: string | number;
    absoluteStrokeWidth?: boolean;
  }

  // 将所有 lucide-react 图标声明为 FC<LucideProps>
  // 这绕过了 ForwardRefExoticComponent 的类型兼容性问题
  export const GitBranch: FC<LucideProps>;
  export const RefreshCw: FC<LucideProps>;
  export const LogOut: FC<LucideProps>;
  export const Check: FC<LucideProps>;
  export const Plus: FC<LucideProps>;
  export const ExternalLink: FC<LucideProps>;
  export const AlertTriangle: FC<LucideProps>;
  export const Shield: FC<LucideProps>;
  export const Star: FC<LucideProps>;
  export const X: FC<LucideProps>;
  export const History: FC<LucideProps>;
  export const ArrowRight: FC<LucideProps>;
}
