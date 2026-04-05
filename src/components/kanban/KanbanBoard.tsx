import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { differenceInHours, format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Filter, Plus, MoreVertical, LayoutGrid, List, User as UserIcon, Phone, MessageSquare, Bot, BadgeDollarSign, CalendarDays, Clock, AlertCircle, Trash2, ChevronDown, Check, MessageCircle, Instagram, Globe } from 'lucide-react';
import StageSelect from './StageSelect';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { STAGES, type KanbanStage } from '../../types/kanban';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type KanbanPriority = 'alta' | 'media' | 'baixa';
type UrgenciaCor = 'Verde' | 'Amarelo' | 'Vermelho';

interface KanbanCardRow {
  id: number;
  lead_id: string;
  hospede_nome: string | null;
  origem: string | null;
  etapa: string;
  resumo_solicitacao: string | null;
  prioridade: string | null;
  ultima_interacao: string;
}

interface KanbanCard {
  id: number;
  lead_id: string;
  hospede_nome: string | null;
  origem: string;
  etapa: KanbanStage;
  resumo_solicitacao: string | null;
  prioridade: KanbanPriority;
  ultima_interacao: string;
}

type KanbanCardsByStage = Record<KanbanStage, KanbanCard[]>;
interface KanbanMetrics {
  totalAtivos: number;
  totalUrgentes: number;
  taxaConversao: number;
}

export type KanbanSyncState = 'connecting' | 'realtime' | 'polling' | 'error';

interface KanbanBoardProps {
  onSyncChange?: (payload: { state: KanbanSyncState; message: string; lastUpdatedAt: string | null }) => void;
}

function normalizeLeadId(value: string | null | undefined) {
  return (value || '').split('@')[0];
}

function isKanbanStage(value: string): value is KanbanStage {
  return STAGES.includes(value as KanbanStage);
}

function isKanbanPriority(value: string | null): value is KanbanPriority {
  return value === 'alta' || value === 'media' || value === 'baixa';
}

function createEmptyStageGroups(): KanbanCardsByStage {
  return STAGES.reduce((acc, stage) => {
    acc[stage] = [];
    return acc;
  }, {} as KanbanCardsByStage);
}

function groupCardsByStage(cards: KanbanCard[]): KanbanCardsByStage {
  return cards.reduce((acc, card) => {
    acc[card.etapa].push(card);
    return acc;
  }, createEmptyStageGroups());
}

export function calcularUrgencia(ultima_interacao: string, etapa: KanbanStage): UrgenciaCor {
  // SLA comercial se aplica nas etapas de topo de funil.
  if (etapa !== 'Novo Lead' && etapa !== 'Cotação Enviada') {
    return 'Verde';
  }

  const hours = differenceInHours(new Date(), new Date(ultima_interacao));

  if (hours > 24) return 'Vermelho';
  if (hours >= 12) return 'Amarelo';
  return 'Verde';
}

function getCardPriority(card: KanbanCard) {
  const hasUsefulName = !!card.hospede_nome && card.hospede_nome !== '.' && card.hospede_nome.toLowerCase() !== 'sem nome';
  const lastInteraction = card.ultima_interacao ? new Date(card.ultima_interacao).getTime() : 0;

  return {
    hasUsefulName,
    lastInteraction,
    id: card.id,
  };
}

function choosePreferredCard(current: KanbanCard, candidate: KanbanCard) {
  const currentPriority = getCardPriority(current);
  const candidatePriority = getCardPriority(candidate);

  if (candidatePriority.hasUsefulName && !currentPriority.hasUsefulName) {
    return { ...candidate, lead_id: normalizeLeadId(candidate.lead_id) };
  }

  if (candidatePriority.hasUsefulName === currentPriority.hasUsefulName) {
    if (candidatePriority.lastInteraction > currentPriority.lastInteraction) {
      return { ...candidate, lead_id: normalizeLeadId(candidate.lead_id) };
    }

    if (candidatePriority.lastInteraction === currentPriority.lastInteraction && candidatePriority.id > currentPriority.id) {
      return { ...candidate, lead_id: normalizeLeadId(candidate.lead_id) };
    }
  }

  return current;
}

function getOrigemConfig(origem: string) {
  const origemNormalizada = origem.trim().toLowerCase();

  if (origemNormalizada.includes('whatsapp')) {
    return {
      icon: MessageCircle,
      label: 'WhatsApp',
      className: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
    };
  }

  if (origemNormalizada.includes('instagram')) {
    return {
      icon: Instagram,
      label: 'Instagram',
      className: 'text-pink-300 border-pink-500/20 bg-pink-500/10',
    };
  }

  return {
    icon: Globe,
    label: origem,
    className: 'text-zinc-300 border-white/10 bg-white/5',
  };
}

function getUrgenciaColorClass(urgencia: UrgenciaCor) {
  switch (urgencia) {
    case 'Verde': return 'bg-green-500/20 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]';
    case 'Amarelo': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]';
    case 'Vermelho': return 'bg-red-500/20 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)] animate-pulse';
    default: return 'bg-zinc-500/20 text-zinc-400';
  }
}

function KanbanLeadCard({
  card,
  onDelete,
  onMove
}: {
  card: KanbanCard;
  onDelete: (id: number) => void;
  onMove: (id: number, newStage: KanbanStage) => void;
}) {
  const urgencia = calcularUrgencia(card.ultima_interacao, card.etapa);
  const origem = getOrigemConfig(card.origem);
  const OrigemIcon = origem.icon;
  const leadPhone = card.lead_id.split('@')[0];
  const interactionDate = format(new Date(card.ultima_interacao), 'dd/MM/yyyy', { locale: ptBR });
  const resumo = card.resumo_solicitacao || 'Sem resumo da solicitação';

  return (
    <div
      className="group relative overflow-hidden bg-[#0f1117] border border-[#1b2230] rounded-xl px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:border-[#2b3b57] hover:bg-[#111626] transition-all duration-300 cursor-default border-l-[3px]"
      style={{ borderLeftColor: urgencia === 'Verde' ? '#22c55e' : urgencia === 'Amarelo' ? '#eab308' : '#ef4444' }}
    >
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-[#2ea8ff]/80 via-[#1f8cf0]/50 to-transparent opacity-70" />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-[#2a364c] to-[#1c2535] flex items-center justify-center text-[10px] text-zinc-300 font-bold border border-[#2a3448] group-hover:border-[#3a4a67]">
            {card.hospede_nome?.substring(0, 1).toUpperCase() || <UserIcon className="w-3 h-3" />}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white truncate leading-none">
              {card.hospede_nome || 'Hóspede'}
            </p>
            <p className="text-[11px] text-zinc-500 truncate mt-1">
              {leadPhone}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="text-[10px] text-zinc-500 tabular-nums pt-0.5">{interactionDate}</div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(card.id);
            }}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-all duration-200 border border-transparent hover:border-red-500/20 active:scale-95"
            title="Excluir card"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 border text-[9px] font-semibold", origem.className)}>
            <OrigemIcon className="h-2.5 w-2.5" />
            {origem.label}
          </span>
          <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 border text-[9px] font-semibold", getUrgenciaColorClass(urgencia))}>
            <Clock className="h-2.5 w-2.5" />
            {formatDistanceToNow(new Date(card.ultima_interacao), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
        <span className="text-[11px] text-white/90 font-semibold tabular-nums shrink-0">
          R$ 0,00
        </span>
      </div>

      <div className="mt-2 rounded-lg bg-[#0b0f18] border border-[#1b2535] px-2 py-1.5">
        <p className="text-[11px] text-zinc-300 leading-snug line-clamp-2">
          {resumo}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-zinc-500 shrink-0">
            <CalendarDays className="w-3 h-3" />
            <Phone className="w-3 h-3" />
            <MessageSquare className="w-3 h-3" />
            <Bot className="w-3 h-3" />
            <BadgeDollarSign className="w-3 h-3" />
          </div>

          <div className="h-3 w-[1px] bg-white/10 mx-1 shrink-0" />

          {/* Seletor de Etapa Manual */}
          <StageSelect
            value={card.etapa}
            onChange={(newStage: KanbanStage) => onMove(card.id, newStage)}
          />
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {urgencia === 'Vermelho' && (
            <div className="animate-pulse">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function calcularMetricas(cards: KanbanCard[]): KanbanMetrics {
  const totalLeads = cards.length;
  const totalAtivos = cards.filter(
    (card) => card.etapa !== 'Perdido/Cancelado' && card.etapa !== 'Check-out/Pós-venda'
  ).length;

  const totalUrgentes = cards.filter(
    (card) => calcularUrgencia(card.ultima_interacao, card.etapa) === 'Vermelho'
  ).length;

  const totalConfirmados = cards.filter((card) => card.etapa === 'Reserva Confirmada').length;
  const taxaConversao = totalLeads > 0 ? (totalConfirmados / totalLeads) * 100 : 0;

  return {
    totalAtivos,
    totalUrgentes,
    taxaConversao,
  };
}

export default function KanbanBoard({ onSyncChange }: KanbanBoardProps) {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este card? Esta ação não pode ser desfeita.')) {
      return;
    }

    const { error } = await supabase
      .from('kanban_cards')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir card:', error);
      alert('Erro ao excluir card. Tente novamente.');
    }
    // O realtime cuidará de atualizar a lista via subscription
  };

  const handleMove = async (id: number, newStage: KanbanStage) => {
    const { error } = await supabase
      .from('kanban_cards')
      .update({
        etapa: newStage,
        ultima_interacao: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Erro ao mover card:', error);
      alert('Erro ao mover card. Tente novamente.');
    }
    // O realtime cuidará de atualizar a lista via subscription
  };
  const syncStateRef = useRef<KanbanSyncState>('connecting');
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    const updateSync = (state: KanbanSyncState, message: string, lastUpdatedAt: string | null = null) => {
      syncStateRef.current = state;
      onSyncChange?.({ state, message, lastUpdatedAt });
    };

    async function fetchCards() {
      const { data, error } = await supabase
        .from('kanban_cards')
        .select('*')
        .order('id', { ascending: false });

      if (error) {
        console.error('Error fetching kanban cards:', error);
        if (mounted) {
          updateSync('error', 'Nao foi possivel atualizar o kanban. Confira a sessao do Supabase.');
        }
      } else {
        if (mounted) {
          const typedCards = ((data || []) as KanbanCardRow[])
            .filter((card) => isKanbanStage(card.etapa))
            .map((card) => ({
              id: card.id,
              lead_id: card.lead_id,
              hospede_nome: card.hospede_nome,
              origem: card.origem || 'WhatsApp',
              etapa: card.etapa as KanbanStage,
              resumo_solicitacao: card.resumo_solicitacao,
              prioridade: isKanbanPriority(card.prioridade) ? card.prioridade : 'media',
              ultima_interacao: card.ultima_interacao,
            }));

          setCards(typedCards);
          updateSync(
            syncStateRef.current === 'polling' ? 'polling' : 'realtime',
            'Kanban sincronizado com o banco.',
            new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          );
        }
      }
      if (mounted) {
        setLoading(false);
      }
    }

    updateSync('connecting', 'Conectando o kanban ao Supabase...');
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          updateSync('realtime', 'Kanban ouvindo mudancas em tempo real.');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          updateSync('polling', 'Realtime do kanban indisponivel. Atualizando por verificacao periodica.');
        }
      });

    const intervalId = window.setInterval(fetchCards, 30000);

    const handleWindowRefresh = () => {
      if (document.visibilityState === 'visible') {
        fetchCards();
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
  }, [onSyncChange]);

  useEffect(() => {
    if (!isDraggingBoard) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const board = boardScrollRef.current;
      if (!board) {
        return;
      }

      const walk = event.pageX - dragStartXRef.current;
      board.scrollLeft = dragStartScrollLeftRef.current - walk;
      event.preventDefault();
    };

    const handleMouseUp = () => {
      setIsDraggingBoard(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingBoard]);

  const dedupedCards = Array.from(
    cards.reduce((acc, card) => {
      const normalizedLeadId = normalizeLeadId(card.lead_id);

      if (!normalizedLeadId) {
        return acc;
      }

      const normalizedCard = { ...card, lead_id: normalizedLeadId };
      const existingCard = acc.get(normalizedLeadId);

      if (!existingCard) {
        acc.set(normalizedLeadId, normalizedCard);
      } else {
        acc.set(normalizedLeadId, choosePreferredCard(existingCard, normalizedCard));
      }

      return acc;
    }, new Map<string, KanbanCard>()).values()
  );
  const cardsByStage = groupCardsByStage(dedupedCards);
  const metricas = calcularMetricas(dedupedCards);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white/20"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#0a0a0a]">
      <div className="px-6 pt-4 pb-2 shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[11px] text-zinc-400 uppercase tracking-wider">Leads Ativos</p>
            <p className="text-2xl font-bold text-white">{metricas.totalAtivos}</p>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <p className="text-[11px] text-red-200 uppercase tracking-wider">Leads com Urgência</p>
            <p className="text-2xl font-bold text-red-300">{metricas.totalUrgentes}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
            <p className="text-[11px] text-emerald-200 uppercase tracking-wider">Taxa de Conversão</p>
            <p className="text-2xl font-bold text-emerald-300">{metricas.taxaConversao.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div
        ref={boardScrollRef}
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          const board = boardScrollRef.current;
          if (!board) return;

          setIsDraggingBoard(true);
          dragStartXRef.current = event.pageX;
          dragStartScrollLeftRef.current = board.scrollLeft;
        }}
        className={cn(
          "flex-1 overflow-x-auto overflow-y-hidden bg-[#0a0a0a] no-scrollbar",
          isDraggingBoard ? "cursor-grabbing select-none" : "cursor-grab"
        )}
      >
        <div className="flex h-full min-w-max p-6 gap-6">
          {STAGES.map((stage) => {
            const stageCards = cardsByStage[stage];
            return (
              <div key={stage} className="w-72 shrink-0 flex flex-col h-full bg-[#0f0f0f]/40 rounded-2xl border border-[#1f1f1f]/50 p-4">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white/20" />
                    {stage}
                  </h3>
                  <span className="text-[10px] font-bold bg-white/5 text-zinc-500 px-2.5 py-1 rounded-full border border-white/5 shadow-inner">
                    {stageCards.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
                  {stageCards.map((card) => {
                    return (
                      <KanbanLeadCard
                        key={card.id}
                        card={card}
                        onDelete={handleDelete}
                        onMove={handleMove}
                      />
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
    </div>
  );
}
