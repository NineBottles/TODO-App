const BoardLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-screen flex-col">
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
      <h1 className="text-lg font-bold tracking-tight text-slate-900">Tika Board</h1>
      <p className="text-xs text-slate-500">티켓 기반 칸반 보드</p>
    </header>
    <main className="min-h-0 flex-1 overflow-hidden p-4">{children}</main>
  </div>
);

export default BoardLayout;
