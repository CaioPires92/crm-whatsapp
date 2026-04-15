export interface ChatLead {
  id: number;
  lead_id: string;
  hospede_nome?: string | null;
  lead_nome?: string | null;
  whatsapp_name?: string | null;
  contact_name?: string | null;
  telefone?: string | null;
  remote_jid?: string;
  avatar_url?: string | null;
}

export interface LeadListItem extends ChatLead {
  hospede_nome: string;
  created_at: string;
  labels?: Array<{ id: string; name: string; color: string }>;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  etapa?: string;
}
