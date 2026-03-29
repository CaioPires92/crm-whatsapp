import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, User as UserIcon } from 'lucide-react';
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

export default function LeadList({ onSelectLead, selectedLeadId }: LeadListProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeads() {
      const { data, error } = await supabase
        .from('Leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching leads:', error);
      } else {
        setLeads(data || []);
      }
      setLoading(false);
    }

    fetchLeads();
  }, []);

  const filteredLeads = leads.filter(lead => 
    lead.lead_nome?.toLowerCase().includes(search.toLowerCase()) ||
    lead.lead_id?.includes(search)
  );

  return (
    <div className="w-[300px] h-full border-r border-[#1f1f1f] flex flex-col shrink-0 bg-[#0f0f0f]">
      <div className="p-4 border-b border-[#1f1f1f]">
        <h2 className="text-sm font-semibold text-white mb-4 tracking-tight">Todas as Conversas</h2>
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
                selectedLeadId === lead.lead_id 
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
                  selectedLeadId === lead.lead_id ? "text-white" : "text-zinc-300"
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
