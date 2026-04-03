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
  chatbot_ativo?: boolean;
  remote_jid?: string;
  last_message_at?: string | null;
  avatar_url?: string | null;
}

export default function Contatos() {
  const [selectedLead, setSelectedLead] = useState<Lead | undefined>();
  const [globalAiEnabled, setGlobalAiEnabled] = useState(true);
  const [loadingGlobalAi, setLoadingGlobalAi] = useState(true);
  const [updatingGlobalAi, setUpdatingGlobalAi] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadGlobalAiState() {
      const { data, error } = await supabase
        .from('Leads')
        .select('id, chatbot_ativo')
        .limit(1000);

      if (error) {
        console.error('Erro ao carregar status global da IA:', error);
        if (mounted) {
          setLoadingGlobalAi(false);
        }
        return;
      }

      if (mounted) {
        const rows = data || [];
        const enabled = rows.some((lead) => lead.chatbot_ativo !== false);
        setGlobalAiEnabled(enabled);
        setLoadingGlobalAi(false);
      }
    }

    loadGlobalAiState();

    return () => {
      mounted = false;
    };
  }, []);

  async function toggleGlobalAi() {
    const newValue = !globalAiEnabled;
    setUpdatingGlobalAi(true);

    const { error } = await supabase
      .from('Leads')
      .update({ chatbot_ativo: newValue })
      .not('id', 'is', null);

    if (error) {
      console.error('Erro ao atualizar IA global:', error);
    } else {
      setGlobalAiEnabled(newValue);
      setSelectedLead((current) => (current ? { ...current, chatbot_ativo: newValue } : current));
    }

    setUpdatingGlobalAi(false);
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b border-[#1f1f1f] bg-[#0a0a0a] px-6 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Automacao</p>
          <h1 className="mt-1 text-lg font-semibold text-white">Controle global da IA</h1>
        </div>

        <button
          type="button"
          onClick={toggleGlobalAi}
          disabled={loadingGlobalAi || updatingGlobalAi}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
            globalAiEnabled
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15'
          }`}
        >
          {loadingGlobalAi || updatingGlobalAi ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : globalAiEnabled ? (
            <Bot className="h-4 w-4" />
          ) : (
            <BotOff className="h-4 w-4" />
          )}
          {loadingGlobalAi
            ? 'Carregando status...'
            : updatingGlobalAi
              ? 'Atualizando...'
              : globalAiEnabled
                ? 'Desligar IA global'
                : 'Ligar IA global'}
        </button>
      </div>

      <div className="flex h-full w-full min-h-0">
      <LeadList 
        onSelectLead={setSelectedLead} 
        selectedLeadId={selectedLead?.lead_id} 
      />
      <ChatArea lead={selectedLead} globalAiEnabled={globalAiEnabled} />
      </div>
    </div>
  );
}
