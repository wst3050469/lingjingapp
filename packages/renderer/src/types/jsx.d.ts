/* eslint-disable @typescript-eslint/no-explicit-any */
// styled-jsx support: allows <style jsx> in components
import 'react';

declare module 'react' {
  interface StyleHTMLAttributes<T> extends React.HTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}
