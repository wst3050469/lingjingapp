/**
 * React 19 JSX compat shim for allotment.
 *
 * allotment@1.20.x was compiled with React 18 types where ReactNode
 * does not include `bigint`. React 19's @types/react adds bigint,
 * causing TS2786 "cannot be used as a JSX component".
 *
 * Re-exporting as loose types bypasses the compatibility check
 * while preserving runtime behavior.
 */
declare module 'allotment' {
  import type { FC, ReactNode, RefAttributes } from 'react';

  export interface CommonProps {
    className?: string;
    maxSize?: number;
    minSize?: number;
    snap?: boolean;
  }

  export interface PaneProps extends CommonProps {
    children: ReactNode;
    preferredSize?: number | string;
    priority?: number;
    visible?: boolean;
  }

  export const Allotment: FC<{
    children: ReactNode;
    className?: string;
    defaultSizes?: number[];
    id?: string;
    proportionalLayout?: boolean;
    separator?: boolean;
    sizes?: number[];
    vertical?: boolean;
    onChange?: (sizes: number[]) => void;
    onReset?: () => void;
    onDragEnd?: (sizes: number[]) => void;
  } & RefAttributes<unknown>> & {
    Pane: FC<PaneProps & RefAttributes<unknown>>;
  };
}
