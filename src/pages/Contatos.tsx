import { useState } from 'react';
import LeadList from '../components/chat/LeadList';
import ChatArea from '../components/chat/ChatArea';

interface Lead {
  id: number;
  lead_nome: string;
  lead_id: string;
  created_at: string;
}

export default function Contatos() {
  const [selectedLead, setSelectedLead] = useState<Lead | undefined>();

  return (
    <div className="flex h-full w-full">
      <LeadList 
        onSelectLead={setSelectedLead} 
        selectedLeadId={selectedLead?.lead_id} 
      />
      <ChatArea lead={selectedLead} />
    </div>
  );
}
