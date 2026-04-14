import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { 
  X, 
  Trash2, 
  Calendar, 
  MessageCircle, 
  Instagram, 
  Globe, 
  User,
  Clock,
  ExternalLink
} from 'lucide-react';
import { KanbanCard, KanbanStage } from '../../types/kanban';
import StageSelect from './StageSelect';
import { calcularUrgencia } from './KanbanBoard';

interface ExpandedCardProps {
  card: KanbanCard;
  onClose: () => void;
  onMove: (id: number, stage: KanbanStage) => void;
  onDelete: (id: number) => void;
}

export function ExpandedCard({ card, onClose, onMove, onDelete }: ExpandedCardProps) {
  const urgencia = calcularUrgencia(card.ultima_interacao, card.etapa);
  
  const getOrigemIcon = (origem: string) => {
    switch (origem.toLowerCase()) {
      case 'whatsapp': return <MessageCircle className="w-5 h-5 text-emerald-400" />;
      case 'instagram': return <Instagram className="w-5 h-5 text-pink-400" />;
      default: return <Globe className="w-5 h-5 text-blue-400" />;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Card Content */}
      <motion.div
        layoutId={`card-${card.id}`}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-2xl bg-[#0f1117] border border-[#1b2230] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header Border Base on Urgency */}
        <div 
          className="h-1.5 w-full" 
          style={{ backgroundColor: urgencia === 'Verde' ? '#22c55e' : urgencia === 'Amarelo' ? '#eab308' : '#ef4444' }} 
        />

        {/* Top Navbar */}
        <div className="p-6 flex items-center justify-between border-b border-[#1b2230] bg-[#11141d]/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2a364c] to-[#1c2535] flex items-center justify-center border-2 border-[#1b2230] overflow-hidden">
              {card.hospede_foto_url ? (
                <img src={card.hospede_foto_url} alt={card.hospede_nome || ''} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-white">
                  {card.hospede_nome?.substring(0, 1).toUpperCase() || <User className="w-7 h-7" />}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{card.hospede_nome || 'Hóspede sem nome'}</h2>
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                {getOrigemIcon(card.origem)}
                <span>{card.origem} • ID: {card.lead_id}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDelete(card.id)}
              className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              title="Excluir Lead"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
          {/* Summary Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium uppercase tracking-wider">
              <MessageCircle className="w-4 h-4" />
              <span>Resumo da Solicitação</span>
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 text-zinc-200 leading-relaxed text-lg italic">
              "{card.resumo_solicitacao || 'Sem detalhes fornecidos.'}"
            </div>
          </section>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-[#161b22]/50 border border-[#30363d] rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase font-bold">Última Interação</p>
                <p className="text-white font-medium">{new Date(card.ultima_interacao).toLocaleString('pt-BR')}</p>
              </div>
            </div>
            
            <div className="bg-[#161b22]/50 border border-[#30363d] rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase font-bold">Urgência / SLA</p>
                <p className="text-white font-medium">{urgencia}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-[#1b2230] bg-[#11141d]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500 font-medium">Alterar Etapa:</span>
            <StageSelect
              value={card.etapa}
              onChange={(newStage) => onMove(card.id, newStage)}
            />
          </div>
          
          <button className="px-6 py-3 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-colors flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Abrir Chat
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
