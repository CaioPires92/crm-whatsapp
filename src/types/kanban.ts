export const STAGES = [
  'Novo Lead',
  'Aguardando Humano',
  'Cotação Enviada',
  'Aguardando Pagamento',
  'Reserva Confirmada',
  'Check-in',
  'Check-out/Pós-venda',
  'Perdido/Cancelado',
] as const;

export type KanbanStage = (typeof STAGES)[number];

export interface KanbanCard {
  id: number;
  lead_id: string;
  hospede_nome: string | null;
  hospede_foto_url: string | null;
  origem: string;
  etapa: KanbanStage;
  resumo_solicitacao: string | null;
  prioridade: 'alta' | 'media' | 'baixa';
  ultima_interacao: string;
}
