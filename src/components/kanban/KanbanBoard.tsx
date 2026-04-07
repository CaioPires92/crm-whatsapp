import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { differenceInHours, format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Trash2, 
  User as UserIcon,
  MessageCircle,
  Instagram,
  Globe,
  Clock,
  Phone,
  MessageSquare,
  Bot,
  BadgeDollarSign,
  AlertCircle,
  CalendarDays,
  Maximize2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StageSelect from './StageSelect';
import { ExpandedCard } from './ExpandedCard';
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
  stage: string; // This comes from DB as 'etapa' after rename, but keep internal prop as stage if preferred or rename to etapa
  resumo_solicitacao: string | null;
  prioridade: string | null;
  ultima_interacao: string;
  leads?: {
    hospede_nome: string | null;
  } | null;
}

interface KanbanCard {
  id: number;
  lead_id: string;
  hospede_nome: string | null;
  hospede_foto_url: string | null;
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

interface DragState {
  isDragging: boolean;
  cardId: number | null;
  card: KanbanCard | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
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

const KanbanLeadCard = memo(function KanbanLeadCard({ 
  card, 
  onMove, 
  onDelete, 
  onExpand,
  onDragStart,
  isDragging,
}: { 
  card: KanbanCard; 
  onMove: (id: number, stage: KanbanStage) => void; 
  onDelete: (id: number) => void; 
  onExpand: (id: number) => void;
  onDragStart?: (cardId: number, card: KanbanCard, e: React.PointerEvent) => void;
  isDragging?: boolean;
}) {
  const urgencia = calcularUrgencia(card.ultima_interacao, card.etapa);
  const origem = getOrigemConfig(card.origem);
  const OrigemIcon = origem.icon;
  const leadPhone = card.lead_id.split('@')[0];
  const interactionDate = format(new Date(card.ultima_interacao), 'dd/MM/yyyy', { locale: ptBR });
  const resumo = card.resumo_solicitacao || 'Sem resumo da solicitação';

  return (
    <motion.div 
      layout
      transition={{ type: "tween", duration: 0.2, ease: "easeInOut" }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button, select, input, [data-no-drag]')) return;
        onDragStart?.(card.id, card, e);
      }}
      onDoubleClick={() => onExpand(card.id)}
      className={cn(
        "kanban-card group relative bg-[#161b22] border border-[#30363d] rounded-xl p-3 hover:border-[#444c56] transition-all duration-200 cursor-grab active:cursor-grabbing overflow-visible touch-none",
        isDragging && "opacity-30 scale-[0.98]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-[#2a364c] to-[#1c2535] flex items-center justify-center text-[10px] text-zinc-300 font-bold border border-[#2a3448] group-hover:border-[#3a4a67] overflow-hidden">
            {card.hospede_foto_url ? (
              <img src={card.hospede_foto_url} alt={card.hospede_nome || ''} className="w-full h-full object-cover" />
            ) : (
              card.hospede_nome?.substring(0, 1).toUpperCase() || <UserIcon className="w-3 h-3" />
            )}
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
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpand(card.id);
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-600 hover:text-white transition-all duration-200 border border-transparent hover:border-white/10 active:scale-95"
              title="Abrir detalhes (ou clique duplo)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
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

          <div data-no-drag>
            <StageSelect
              value={card.etapa}
              onChange={(newStage: KanbanStage) => onMove(card.id, newStage)}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {urgencia === 'Vermelho' && (
            <div className="animate-pulse">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

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

function DragOverlay({ card, position }: { card: KanbanCard; position: { x: number; y: number } }) {
  const urgencia = calcularUrgencia(card.ultima_interacao, card.etapa);
  const origem = getOrigemConfig(card.origem);
  const OrigemIcon = origem.icon;
  const leadPhone = card.lead_id.split('@')[0];
  const resumo = card.resumo_solicitacao || 'Sem resumo da solicitação';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1.03 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
      transition={{ type: "tween", duration: 0.1, ease: "easeOut" }}
      style={{
        position: 'fixed',
        left: position.x - 144,
        top: position.y - 40,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
      className="w-72"
    >
      <div className="bg-[#161b22] border border-white/20 rounded-xl p-3 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-[#2a364c] to-[#1c2535] flex items-center justify-center text-[10px] text-zinc-300 font-bold border border-[#2a3448] overflow-hidden">
              {card.hospede_foto_url ? (
                <img src={card.hospede_foto_url} alt={card.hospede_nome || ''} className="w-full h-full object-cover" />
              ) : (
                card.hospede_nome?.substring(0, 1).toUpperCase() || <UserIcon className="w-3 h-3" />
              )}
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
          <div className="flex items-center gap-1.5 text-zinc-500 shrink-0">
            <CalendarDays className="w-3 h-3" />
            <Phone className="w-3 h-3" />
            <MessageSquare className="w-3 h-3" />
            <Bot className="w-3 h-3" />
            <BadgeDollarSign className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {urgencia === 'Vermelho' && (
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function KanbanBoard({ onSyncChange }: KanbanBoardProps) {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    cardId: null,
    card: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);

  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

  const fetchCards = useCallback(async () => {
    const { data, error } = await supabase
      .from('kanban_cards')
      .select('*, leads(hospede_nome)')
      .order('id', { ascending: false });

    if (error) {
      console.error('Error fetching kanban cards:', error);
      return;
    }

    const typedCards = ((data || []) as unknown as any[])
      .filter((card) => isKanbanStage(card.etapa))
      .map((card) => ({
        id: card.id,
        lead_id: card.lead_id,
        hospede_nome: card.leads?.hospede_nome || null,
        hospede_foto_url: null,
        origem: 'WhatsApp',
        etapa: card.etapa as KanbanStage,
        resumo_solicitacao: card.resumo_solicitacao,
        prioridade: isKanbanPriority(card.prioridade) ? card.prioridade : 'media',
        ultima_interacao: card.ultima_interacao,
      }));

    setCards(typedCards);
  }, []);

  const deleteCard = useCallback(async (id: number) => {
    // Atualização otimista: remove o card da lista local imediatamente
    setCards(prev => prev.filter(c => c.id !== id));

    const { error } = await supabase
      .from('kanban_cards')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir card:', error);
      alert('Erro ao excluir card. Tente novamente.');
      // Rollback: recarrega a lista se falhar no banco
      fetchCards();
    }
  }, [fetchCards]);

  const moveCard = useCallback(async (id: number, newStage: KanbanStage) => {
    // Atualização otimista: move o card visualmente para a nova coluna na hora!
    setCards(prev => prev.map(c => 
      c.id === id 
        ? { ...c, etapa: newStage, ultima_interacao: new Date().toISOString() } 
        : c
    ));

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
      // Rollback: volta o card pra posição original se o banco falhar
      fetchCards();
    }
  }, [fetchCards]);

  const handleExpand = useCallback((id: number) => {
    setExpandedCardId(id);
  }, []);

  const handleDragStart = useCallback((cardId: number, card: KanbanCard, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragState({
      isDragging: true,
      cardId,
      card,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    });

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    const state = dragStateRef.current;
    if (!state.isDragging) return;

    setDragState(prev => ({
      ...prev,
      currentX: e.clientX,
      currentY: e.clientY,
    }));

    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const column = elements.find(el => el.classList.contains('kanban-column'));
    const targetStage = column?.getAttribute('data-stage') || null;
    
    setHoveredColumn(targetStage);
  }, []);

  const handleDragEnd = useCallback(async (e: React.PointerEvent) => {
    const state = dragStateRef.current;
    if (!state.isDragging || !state.card) return;

    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const column = elements.find(el => el.classList.contains('kanban-column'));
    const newStage = column?.getAttribute('data-stage') as KanbanStage;

    if (newStage && newStage !== state.card.etapa) {
      // Dispara a atualização em segundo plano SEM esperar (já é otimista)
      moveCard(state.cardId!, newStage);
    }

    setDragState({
      isDragging: false,
      cardId: null,
      card: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    });
    setHoveredColumn(null);
  }, [moveCard]);

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

    async function init() {
      await fetchCards();
      if (mounted) setLoading(false);
      updateSync('realtime', 'Kanban sincronizado.');
    }

    init();

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
      mounted = false;
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
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          if (dragState.isDragging) return;
          
          const target = event.target as HTMLElement;
          if (target.closest('.kanban-card')) return;

          const board = boardScrollRef.current;
          if (!board) return;

          setIsDraggingBoard(true);
          dragStartXRef.current = event.pageX;
          dragStartScrollLeftRef.current = board.scrollLeft;
        }}
        className={cn(
          "flex-1 overflow-x-auto overflow-y-hidden bg-[#0a0a0a] no-scrollbar",
          isDraggingBoard ? "cursor-grabbing select-none" : "cursor-grab",
          dragState.isDragging && "select-none"
        )}
      >
        <div className="flex h-full min-w-max p-6 gap-6">
          {STAGES.map((stage) => {
            const stageCards = cardsByStage[stage];
            const isHovered = hoveredColumn === stage;
            return (
              <div
                key={stage}
                data-stage={stage}
                className={cn(
                  "kanban-column w-72 shrink-0 flex flex-col h-full rounded-2xl border p-4 transition-all duration-200",
                  isHovered
                    ? "bg-[#161b22]/80 border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.05)]"
                    : "bg-[#0f0f0f]/40 border-[#1f1f1f]/50"
                )}
              >
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className={cn(
                    "text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors",
                    isHovered ? "text-white" : "text-zinc-400"
                  )}>
                    <span className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      isHovered ? "bg-white/60" : "bg-white/20"
                    )} />
                    {stage}
                  </h3>
                  <span className={cn(
                    "text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-inner transition-colors",
                    isHovered 
                      ? "bg-white/10 text-white border-white/20" 
                      : "bg-white/5 text-zinc-500 border-white/5"
                  )}>
                    {stageCards.length}
                  </span>
                </div>

                  <div className={cn(
                    "flex-1 space-y-3 pr-1 no-scrollbar transition-all duration-200",
                    isHovered ? "overflow-visible" : "overflow-y-auto"
                  )}>
                    <AnimatePresence mode="popLayout">
                      {stageCards.map((card) => {
                        return (
                          <motion.div
                            key={card.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ layout: { duration: 0.2, ease: "easeInOut" }, opacity: { duration: 0.15 } }}
                          >
                            <KanbanLeadCard 
                              card={card} 
                              onMove={moveCard}
                              onDelete={deleteCard}
                              onExpand={handleExpand}
                              onDragStart={handleDragStart}
                              isDragging={dragState.isDragging && dragState.cardId === card.id}
                            />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {stageCards.length === 0 && (
                    <div className={cn(
                      "h-24 border-2 border-dashed rounded-xl flex items-center justify-center transition-all",
                      isHovered 
                        ? "border-white/20 bg-white/5" 
                        : "border-white/5"
                    )}>
                      <div className="text-center">
                        <p className={cn(
                          "text-[10px] font-medium uppercase tracking-tighter transition-colors",
                          isHovered ? "text-zinc-400" : "text-zinc-600"
                        )}>
                          {isHovered ? "Solte aqui" : "Vazio"}
                        </p>
                      </div>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {dragState.isDragging && dragState.card && (
          <DragOverlay card={dragState.card} position={{ x: dragState.currentX, y: dragState.currentY }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expandedCardId && (
          <ExpandedCard
            card={cards.find(c => c.id === expandedCardId)!}
            onClose={() => setExpandedCardId(null)}
            onMove={moveCard}
            onDelete={async (id: number) => {
              await deleteCard(id);
              setExpandedCardId(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
