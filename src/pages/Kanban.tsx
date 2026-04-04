import { useEffect, useState } from 'react';
import { AlertTriangle, Radio, RefreshCw } from 'lucide-react';
import KanbanBoard, { type KanbanSyncState } from '../components/kanban/KanbanBoard';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from '../lib/supabase';
import AuraModeControl, { type AssistantMode } from '../components/AuraModeControl';

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
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('auto');
  const [assistantEnabled, setAssistantEnabled] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [modeSaving, setModeSaving] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);

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

  useEffect(() => {
    let mounted = true;

    async function loadAssistantSettings() {
      const { data, error } = await supabase
        .from('assistant_settings')
        .select('mode, assistant_enabled')
        .eq('id', 1)
        .maybeSingle();

      if (!mounted) {
        return;
      }

      if (error) {
        console.error('Error fetching assistant settings:', error);
        setModeError('Nao foi possivel carregar o modo da Aura.');
        setSettingsLoading(false);
        return;
      }

      setAssistantMode((data?.mode as AssistantMode) || 'auto');
      setAssistantEnabled(data?.assistant_enabled !== false);
      setSettingsLoading(false);
    }

    loadAssistantSettings();

    const channel = supabase
      .channel('assistant-settings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assistant_settings' },
        (payload) => {
          const row = payload.new as { mode?: AssistantMode; assistant_enabled?: boolean } | undefined;
          if (!mounted || !row) {
            return;
          }

          setAssistantMode(row.mode || 'auto');
          setAssistantEnabled(row.assistant_enabled !== false);
          setModeError(null);
          setSettingsLoading(false);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  async function updateAssistantMode(nextMode: Extract<AssistantMode, 'auto' | 'manual'>) {
    if (modeSaving || settingsLoading || assistantMode === nextMode) {
      return;
    }

    setModeSaving(true);
    setModeError(null);

    const { error } = await supabase
      .from('assistant_settings')
      .update({ mode: nextMode })
      .eq('id', 1);

    if (error) {
      console.error('Error updating assistant mode:', error);
      setModeError('Nao foi possivel atualizar o modo da Aura.');
    } else {
      setAssistantMode(nextMode);
    }

    setModeSaving(false);
  }

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
          <AuraModeControl
            assistantMode={assistantMode}
            assistantEnabled={assistantEnabled}
            loading={settingsLoading}
            saving={modeSaving}
            onChangeMode={updateAssistantMode}
          />

          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px]", syncTone)}>
            <SyncIcon className={cn("h-3.5 w-3.5", sync.state === 'polling' || sync.state === 'connecting' ? 'animate-spin' : '')} />
            <div className="leading-tight">
              <p>{sync.message}</p>
              {sync.lastUpdatedAt && <p className="opacity-80">Ultima atualizacao: {sync.lastUpdatedAt}</p>}
            </div>
          </div>
        </div>
      </div>

      {modeError && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-8 py-2 text-xs text-red-200">
          {modeError}
        </div>
      )}
      
      <KanbanBoard onSyncChange={setSync} />
    </div>
  );
}
