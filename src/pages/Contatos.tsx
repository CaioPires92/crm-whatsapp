import { useEffect, useState } from 'react';
import { Bot, BotOff, RefreshCw } from 'lucide-react';
import LeadList from '../components/chat/LeadList';
import ChatArea from '../components/chat/ChatArea';
import { supabase } from '../lib/supabase';

interface Lead {
  id: number;
  lead_nome: string;
  lead_id: string;
  created_at: string;
  labels?: any[];
  remote_jid?: string;
  last_message_at?: string | null;
  avatar_url?: string | null;
}

type AssistantMode = 'auto' | 'manual' | 'hybrid';

export default function Contatos() {
  const [selectedLead, setSelectedLead] = useState<Lead | undefined>();
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('auto');
  const [assistantEnabled, setAssistantEnabled] = useState(true);
  const [loadingAssistantMode, setLoadingAssistantMode] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadAssistantState() {
      const { data, error } = await supabase
        .from('assistant_settings')
        .select('mode, assistant_enabled')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        console.error('Erro ao carregar status da Aura:', error);
        if (mounted) {
          setLoadingAssistantMode(false);
        }
        return;
      }

      if (mounted) {
        setAssistantMode((data?.mode as AssistantMode) || 'auto');
        setAssistantEnabled(data?.assistant_enabled !== false);
        setLoadingAssistantMode(false);
      }
    }

    loadAssistantState();

    const channel = supabase
      .channel('assistant-settings-chat-view')
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
          setLoadingAssistantMode(false);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const isAutoReplyActive = assistantEnabled && assistantMode === 'auto';

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b border-[#1f1f1f] bg-[#0a0a0a] px-6 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Automacao</p>
          <h1 className="mt-1 text-lg font-semibold text-white">Status operacional da Aura</h1>
        </div>

        <div
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
            isAutoReplyActive
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15'
          }`}
        >
          {loadingAssistantMode ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : isAutoReplyActive ? (
            <Bot className="h-4 w-4" />
          ) : (
            <BotOff className="h-4 w-4" />
          )}
          {loadingAssistantMode
            ? 'Carregando status...'
            : isAutoReplyActive
              ? 'Piloto automatico ativo'
              : assistantEnabled
                ? 'Modo manual ativo'
                : 'Aura desabilitada'}
        </div>
      </div>

      <div className="flex h-full w-full min-h-0">
      <LeadList 
        onSelectLead={setSelectedLead} 
        selectedLeadId={selectedLead?.lead_id} 
      />
      <ChatArea lead={selectedLead} globalAiEnabled={isAutoReplyActive} />
      </div>
    </div>
  );
}
