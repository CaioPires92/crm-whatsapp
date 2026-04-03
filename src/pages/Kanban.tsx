import { useState } from 'react';
import { AlertTriangle, Radio, RefreshCw } from 'lucide-react';
import KanbanBoard, { type KanbanSyncState } from '../components/kanban/KanbanBoard';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Kanban() {
  const [sync, setSync] = useState<{
    state: KanbanSyncState;
    message: string;
    lastUpdatedAt: string | null;
  }>({
    state: 'connecting',
    message: 'Conectando o kanban ao Supabase...',
    lastUpdatedAt: null,
  });

  const syncTone =
    sync.state === 'realtime'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
      : sync.state === 'polling'
        ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
        : sync.state === 'error'
          ? 'border-red-500/20 bg-red-500/10 text-red-300'
          : 'border-white/10 bg-white/5 text-zinc-300';

  const SyncIcon =
    sync.state === 'realtime' ? Radio : sync.state === 'error' ? AlertTriangle : RefreshCw;

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
          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px]", syncTone)}>
            <SyncIcon className={cn("h-3.5 w-3.5", sync.state === 'polling' || sync.state === 'connecting' ? 'animate-spin' : '')} />
            <div className="leading-tight">
              <p>{sync.message}</p>
              {sync.lastUpdatedAt && <p className="opacity-80">Ultima atualizacao: {sync.lastUpdatedAt}</p>}
            </div>
          </div>
        </div>
      </div>
      
      <KanbanBoard onSyncChange={setSync} />
    </div>
  );
}
