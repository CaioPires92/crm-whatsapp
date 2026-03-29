import KanbanBoard from '../components/kanban/KanbanBoard';

export default function Kanban() {
  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      <div className="h-16 border-b border-[#1f1f1f] flex items-center justify-between px-8 shrink-0 bg-[#0a0a0a]/80 backdrop-blur-md z-10">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-3">
            Fluxo de Reservas
            <span className="px-2 py-0.5 bg-white/5 text-zinc-500 text-[10px] font-bold rounded-full border border-white/5">HOTEL</span>
          </h2>
          <p className="text-xs text-zinc-500">Gestão de leads e cotações em tempo real.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Realtime Ativo</span>
          </div>
        </div>
      </div>
      
      <KanbanBoard />
    </div>
  );
}
