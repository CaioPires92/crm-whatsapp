import { Bot, BotOff, RefreshCw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type AssistantMode = 'auto' | 'manual' | 'hybrid';

interface AuraModeControlProps {
  assistantMode: AssistantMode;
  assistantEnabled: boolean;
  loading?: boolean;
  saving?: boolean;
  compact?: boolean;
  onChangeMode?: (nextMode: 'auto' | 'manual') => void;
}

export default function AuraModeControl({
  assistantMode,
  assistantEnabled,
  loading = false,
  saving = false,
  compact = false,
  onChangeMode,
}: AuraModeControlProps) {
  const isAutoReplyActive = assistantEnabled && assistantMode === 'auto';
  const isManual = assistantEnabled && assistantMode === 'manual';

  const shellTone = !assistantEnabled
    ? 'border-red-500/10 text-red-400'
    : isManual
      ? 'border-zinc-800 text-amber-400/90'
      : 'border-zinc-800 text-sky-400/90';

  const statusLabel = loading
    ? 'Analizando...'
    : !assistantEnabled
      ? 'Desativada'
      : isManual
        ? 'Manual'
        : 'Automático';

  const StatusIcon = loading ? RefreshCw : isAutoReplyActive ? Bot : BotOff;

  return (
    <div className={cn('flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-1.5 transition-all duration-300')}>
      <div className="flex items-center gap-2 pr-4 border-r border-zinc-800/50">
        <div className="relative">
          <StatusIcon className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          {assistantEnabled && !loading && (
            <span className={cn(
              "absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full",
              isAutoReplyActive ? "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
            )} />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">AURA</span>
          <span className={cn("text-[11px] font-medium leading-none mt-0.5", shellTone.split(' ')[1])}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChangeMode?.('auto')}
          disabled={loading || saving || !assistantEnabled || !onChangeMode}
          className={cn(
            'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all duration-200',
            assistantMode === 'auto' 
              ? 'bg-zinc-800 text-sky-400 shadow-sm' 
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5',
            (loading || saving || !assistantEnabled || !onChangeMode) && 'cursor-not-allowed opacity-40'
          )}
        >
          Automático
        </button>
        <button
          type="button"
          onClick={() => onChangeMode?.('manual')}
          disabled={loading || saving || !onChangeMode}
          className={cn(
            'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all duration-200',
            assistantMode === 'manual' 
              ? 'bg-zinc-800 text-amber-400 shadow-sm' 
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5',
            (loading || saving || !onChangeMode) && 'cursor-not-allowed opacity-40'
          )}
        >
          Manual
        </button>
      </div>
    </div>
  );
}
