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
    ? 'border-red-500/20 bg-red-500/10 text-red-100'
    : isManual
      ? 'border-amber-500/20 bg-amber-500/10 text-amber-100'
      : 'border-sky-500/20 bg-sky-500/10 text-sky-100';

  const statusLabel = loading
    ? 'Carregando modo operacional...'
    : !assistantEnabled
      ? 'Aura desabilitada'
      : isManual
        ? 'Modo manual'
        : 'Piloto automatico';

  const StatusIcon = loading ? RefreshCw : isAutoReplyActive ? Bot : BotOff;

  return (
    <div className={cn('flex items-center rounded-xl border', shellTone, compact ? 'gap-2 px-3 py-2' : 'gap-3 px-3 py-2')}>
      <div className="flex items-center gap-2">
        <StatusIcon className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        <div className="leading-tight">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Aura</p>
          <p className="text-[11px] opacity-80">{statusLabel}</p>
        </div>
      </div>

      <div className="flex items-center rounded-lg border border-white/10 bg-black/20 p-1">
        <button
          type="button"
          onClick={() => onChangeMode?.('auto')}
          disabled={loading || saving || !assistantEnabled || !onChangeMode}
          className={cn(
            'rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
            assistantMode === 'auto' ? 'bg-sky-500 text-slate-950' : 'text-zinc-300 hover:bg-white/5',
            (loading || saving || !assistantEnabled || !onChangeMode) && 'cursor-not-allowed opacity-60'
          )}
        >
          Piloto Automatico
        </button>
        <button
          type="button"
          onClick={() => onChangeMode?.('manual')}
          disabled={loading || saving || !onChangeMode}
          className={cn(
            'rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
            assistantMode === 'manual' ? 'bg-amber-400 text-slate-950' : 'text-zinc-300 hover:bg-white/5',
            (loading || saving || !onChangeMode) && 'cursor-not-allowed opacity-60'
          )}
        >
          Modo Manual
        </button>
      </div>
    </div>
  );
}
