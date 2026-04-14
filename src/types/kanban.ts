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
