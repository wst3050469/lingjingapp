export function Sidebar({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col bg-cp-sidebar overflow-hidden">
      {children}
    </div>
  );
}
