import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, User as UserIcon, RefreshCw, AlertTriangle, Radio } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Lead {
  id: number;
  lead_nome: string;
  lead_id: string;
  created_at: string;
}

interface LeadListProps {
  onSelectLead: (lead: Lead) => void;
  selectedLeadId?: string;
}

type SyncState = 'connecting' | 'realtime' | 'polling' | 'error';

function normalizeLeadId(value: string | null | undefined) {
  return (value || '').split('@')[0];
}

function getLeadPriority(lead: Lead) {
  const hasUsefulName = !!lead.lead_nome && lead.lead_nome !== '.' && lead.lead_nome.toLowerCase() !== 'sem nome';
  const createdAt = lead.created_at ? new Date(lead.created_at).getTime() : 0;

  return {
    hasUsefulName,
    createdAt,
    id: lead.id,
  };
}

function choosePreferredLead(current: Lead, candidate: Lead) {
  const currentPriority = getLeadPriority(current);
  const candidatePriority = getLeadPriority(candidate);

  if (candidatePriority.hasUsefulName && !currentPriority.hasUsefulName) {
    return { ...candidate, lead_id: normalizeLeadId(candidate.lead_id) };
  }

  if (candidatePriority.hasUsefulName === currentPriority.hasUsefulName) {
    if (candidatePriority.createdAt > currentPriority.createdAt) {
      return { ...candidate, lead_id: normalizeLeadId(candidate.lead_id) };
    }

    if (candidatePriority.createdAt === currentPriority.createdAt && candidatePriority.id > currentPriority.id) {
      return { ...candidate, lead_id: normalizeLeadId(candidate.lead_id) };
    }
  }

  return current;
}

export default function LeadList({ onSelectLead, selectedLeadId }: LeadListProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>('connecting');
  const [syncMessage, setSyncMessage] = useState('Conectando com o Supabase...');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchLeads() {
      const { data, error } = await supabase
        .from('Leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching leads:', error);
        if (mounted) {
          setSyncState('error');
          setSyncMessage('Nao foi possivel atualizar os contatos. Verifique a sessao do Supabase.');
        }
      } else {
        if (mounted) {
          setLeads(data || []);
          setLastUpdatedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
          setSyncState((current) => (current === 'error' ? 'polling' : current));
          setSyncMessage('Lista sincronizada com fallback automatico.');
        }
      }
      if (mounted) {
        setLoading(false);
      }
    }

    fetchLeads();

    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Leads' },
        () => {
          fetchLeads();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setSyncState('realtime');
          setSyncMessage('Novos contatos entram em tempo real.');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error('Lead realtime channel failed. Falling back to polling.');
          setSyncState('polling');
          setSyncMessage('Realtime indisponivel. Atualizando contatos por verificacao periodica.');
        }
      });

    const intervalId = window.setInterval(fetchLeads, 30000);

    const handleWindowRefresh = () => {
      if (document.visibilityState === 'visible') {
        fetchLeads();
      }
    };

    window.addEventListener('focus', handleWindowRefresh);
    document.addEventListener('visibilitychange', handleWindowRefresh);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowRefresh);
      document.removeEventListener('visibilitychange', handleWindowRefresh);
      supabase.removeChannel(channel);
    };
  }, []);

  const dedupedLeads = Array.from(
    leads.reduce((acc, lead) => {
      const normalizedLeadId = normalizeLeadId(lead.lead_id);

      if (!normalizedLeadId) {
        return acc;
      }

      const normalizedLead = { ...lead, lead_id: normalizedLeadId };
      const existingLead = acc.get(normalizedLeadId);

      if (!existingLead) {
        acc.set(normalizedLeadId, normalizedLead);
      } else {
        acc.set(normalizedLeadId, choosePreferredLead(existingLead, normalizedLead));
      }

      return acc;
    }, new Map<string, Lead>()).values()
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filteredLeads = dedupedLeads.filter(lead => 
    lead.lead_nome?.toLowerCase().includes(search.toLowerCase()) ||
    lead.lead_id?.includes(search)
  );

  const syncTone =
    syncState === 'realtime'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
      : syncState === 'polling'
        ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
        : syncState === 'error'
          ? 'border-red-500/20 bg-red-500/10 text-red-300'
          : 'border-white/10 bg-white/5 text-zinc-300';

  const SyncIcon =
    syncState === 'realtime' ? Radio : syncState === 'error' ? AlertTriangle : RefreshCw;

  return (
    <div className="w-[300px] h-full border-r border-[#1f1f1f] flex flex-col shrink-0 bg-[#0f0f0f]">
      <div className="p-4 border-b border-[#1f1f1f]">
        <h2 className="text-sm font-semibold text-white mb-4 tracking-tight">Todas as Conversas</h2>
        <div className={cn("mb-3 rounded-lg border px-3 py-2 text-[11px]", syncTone)}>
          <div className="flex items-center gap-2">
            <SyncIcon className={cn("h-3.5 w-3.5", syncState === 'polling' || syncState === 'connecting' ? 'animate-spin' : '')} />
            <span>{syncMessage}</span>
          </div>
          {lastUpdatedAt && (
            <p className="mt-1 text-[10px] opacity-80">Ultima atualizacao: {lastUpdatedAt}</p>
          )}
        </div>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
          <input
            type="text"
            placeholder="Buscar contato..."
            className="w-full bg-white/5 border border-[#1f1f1f] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="p-4 text-center text-xs text-zinc-500">Carregando contatos...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-500">Nenhum contato encontrado</div>
        ) : (
          filteredLeads.map((lead) => (
            <button
              key={lead.id}
              onClick={() => onSelectLead(lead)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group text-left",
                normalizeLeadId(selectedLeadId) === lead.lead_id 
                  ? "bg-white/10 ring-1 ring-white/10" 
                  : "hover:bg-white/5"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1d1d1d] to-[#121212] border border-[#1f1f1f] flex items-center justify-center text-zinc-400 group-hover:scale-105 transition-transform duration-200">
                <UserIcon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium truncate",
                  normalizeLeadId(selectedLeadId) === lead.lead_id ? "text-white" : "text-zinc-300"
                )}>
                  {lead.lead_nome || 'Sem nome'}
                </p>
                <p className="text-xs text-zinc-500 truncate mt-0.5">
                  @{lead.lead_id}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
