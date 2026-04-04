import { useEffect, useState } from 'react';
import LeadList from '../components/chat/LeadList';
import ChatArea from '../components/chat/ChatArea';
import { supabase } from '../lib/supabase';
import AuraModeControl, { type AssistantMode } from '../components/AuraModeControl';

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

        <AuraModeControl
          assistantMode={assistantMode}
          assistantEnabled={assistantEnabled}
          loading={loadingAssistantMode}
        />
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
