import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { differenceInHours, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, MessageSquare, AlertCircle, User as UserIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface KanbanCard {
  id: number;
  lead_id: string;
  hospede_nome: string;
  etapa: string;
  resumo_solicitacao: string;
  ultima_interacao: string;
}

const STAGES = [
  'Novo Lead', 
  'Cotação Enviada', 
  'Aguardando Pagamento', 
  'Reserva Confirmada', 
  'Check-in', 
  'Check-out/Pós-venda', 
  'Perdido/Cancelado'
];

export default function KanbanBoard() {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCards();

    const channel = supabase
      .channel('kanban-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kanban_cards' },
        () => {
          fetchCards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchCards() {
    const { data, error } = await supabase
      .from('kanban_cards')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      console.error('Error fetching kanban cards:', error);
    } else {
      setCards(data || []);
    }
    setLoading(false);
  }

  const getTemperature = (lastInteraction: string) => {
    const hours = differenceInHours(new Date(), new Date(lastInteraction));
    if (hours < 4) return 'green';
    if (hours < 12) return 'yellow';
    return 'red';
  };

  const getTemperatureColor = (temp: string) => {
    switch (temp) {
      case 'green': return 'bg-green-500/20 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]';
      case 'yellow': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]';
      case 'red': return 'bg-red-500/20 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)] animate-pulse';
      default: return 'bg-zinc-500/20 text-zinc-400';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white/20"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-x-auto bg-[#0a0a0a] scrollbar-thin">
      <div className="flex h-full min-w-max p-6 gap-6">
        {STAGES.map((stage) => {
          const stageCards = cards.filter(card => card.etapa === stage);
          return (
            <div key={stage} className="w-72 flex flex-col h-full bg-[#0f0f0f]/40 rounded-2xl border border-[#1f1f1f]/50 p-4">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white/20" />
                  {stage}
                </h3>
                <span className="text-[10px] font-bold bg-white/5 text-zinc-500 px-2.5 py-1 rounded-full border border-white/5 shadow-inner">
                  {stageCards.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                {stageCards.map((card) => {
                  const temp = getTemperature(card.ultima_interacao);
                  return (
                    <div 
                      key={card.id}
                      className="group bg-[#161616] border border-[#1f1f1f] rounded-xl p-3 shadow-sm hover:shadow-xl hover:border-zinc-700/50 hover:bg-[#1c1c1c] transition-all duration-300 cursor-pointer active:scale-[0.98] border-l-4"
                      style={{ borderLeftColor: temp === 'green' ? '#22c55e' : temp === 'yellow' ? '#eab308' : '#ef4444' }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-zinc-400 font-bold border border-white/10 group-hover:border-white/20">
                            {card.hospede_nome?.substring(0, 1).toUpperCase() || <UserIcon className="w-3 h-3" />}
                          </div>
                          <span className="text-sm font-semibold text-white tracking-tight leading-none truncate w-32">
                            {card.hospede_nome || 'Hóspede'}
                          </span>
                        </div>
                        <div className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1",
                          getTemperatureColor(temp)
                        )}>
                          <Clock className="w-2.5 h-2.5" />
                          {formatDistanceToNow(new Date(card.ultima_interacao), { addSuffix: true, locale: ptBR })}
                        </div>
                      </div>

                      {card.resumo_solicitacao && (
                        <div className="bg-black/20 rounded-lg p-2 mb-3 border border-white/5 group-hover:border-white/10 transition-colors">
                          <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2 italic">
                            "{card.resumo_solicitacao}"
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-2 text-zinc-600 group-hover:text-zinc-500">
                          <MessageSquare className="w-3 h-3" />
                          <span className="text-[10px] tabular-nums">@{card.lead_id.split('@')[0]}</span>
                        </div>
                        
                        {temp === 'red' && (
                          <div className="animate-bounce">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {stageCards.length === 0 && (
                  <div className="h-24 border-2 border-dashed border-white/5 rounded-xl flex items-center justify-center group/empty">
                    <p className="text-[10px] text-zinc-700 font-medium group-hover/empty:text-zinc-600 transition-colors">Sem cards nesta etapa</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
