import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { format, isToday, isYesterday, isSameYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, MessageSquare, AlertCircle, Radio, RefreshCw, AlertTriangle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: number;
  session_id: string;
  message: {
    type: 'human' | 'ai';
    content: string;
  };
  hora_data_mensagem: string | null;
}

interface ChatAreaProps {
  lead?: {
    lead_nome: string;
    lead_id: string;
  };
}

type SyncState = 'idle' | 'connecting' | 'realtime' | 'polling' | 'error';

function normalizeSessionId(value: string | null | undefined) {
  return (value || '').split('@')[0];
}

export default function ChatArea({ lead }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncMessage, setSyncMessage] = useState('Selecione uma conversa para sincronizar.');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lead) {
      setMessages([]);
      setLoading(false);
      setSyncState('idle');
      setSyncMessage('Selecione uma conversa para acompanhar as mensagens.');
      setLastUpdatedAt(null);
      return;
    }

    let mounted = true;
    const normalizedLeadId = normalizeSessionId(lead.lead_id);

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('n8n_chat_histories')
        .select('*')
        .or(`session_id.eq.${lead.lead_id},session_id.eq.${normalizedLeadId}@s.whatsapp.net,session_id.eq.${normalizedLeadId}@c.us`)
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        if (mounted) {
          setSyncState('error');
          setSyncMessage('Nao foi possivel carregar mensagens novas. Confira sua sessao ou as politicas do Supabase.');
        }
      } else if (mounted) {
        setMessages(data || []);
        setLastUpdatedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        setSyncState((current) => (current === 'error' ? 'polling' : current));
        setSyncMessage('Historico sincronizado com fallback automatico.');
      }

      if (mounted) {
        setLoading(false);
      }
    };

    setSyncState('connecting');
    setSyncMessage(`Conectando com a conversa ${lead.lead_id}...`);
    setLoading(true);
    fetchMessages();

    const channel = supabase
      .channel(`chat-${normalizedLeadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'n8n_chat_histories',
        },
        (payload) => {
          const payloadSessionId = normalizeSessionId((payload.new as Message | undefined)?.session_id || (payload.old as Message | undefined)?.session_id);
          if (payloadSessionId === normalizedLeadId) {
            fetchMessages();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setSyncState('realtime');
          setSyncMessage('Mensagens chegando em tempo real.');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error(`Chat realtime channel failed for ${lead.lead_id}. Falling back to polling.`);
          setSyncState('polling');
          setSyncMessage('Realtime indisponivel. Consultando novas mensagens periodicamente.');
        }
      });

    const intervalId = window.setInterval(fetchMessages, 15000);

    const handleWindowRefresh = () => {
      if (document.visibilityState === 'visible') {
        fetchMessages();
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
  }, [lead]);

  useEffect(() => {
    if (viewportRef.current) {
      setTimeout(() => {
        if (viewportRef.current) {
          viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
        }
      }, 120);
    }
  }, [messages]);

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { [key: string]: Message[] } = {};

    msgs.forEach((msg) => {
      let dateKey = 'Sem data';
      if (msg.hora_data_mensagem) {
        const date = new Date(msg.hora_data_mensagem);
        if (isToday(date)) {
          dateKey = 'Hoje';
        } else if (isYesterday(date)) {
          dateKey = 'Ontem';
        } else if (isSameYear(date, new Date())) {
          dateKey = format(date, "dd 'de' MMMM", { locale: ptBR });
        } else {
          dateKey = format(date, "dd/MM/yyyy", { locale: ptBR });
        }
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });

    return groups;
  };

  if (!lead) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-[#0a0a0a] text-zinc-500">
        <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm">Selecione uma conversa para começar</p>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);
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
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0a]">
      <div className="h-16 border-b border-[#1f1f1f] flex items-center justify-between px-6 bg-[#0a0a0a]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1d1d1d] to-[#121212] flex items-center justify-center text-zinc-400 border border-[#1f1f1f]">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">{lead.lead_nome || lead.lead_id}</h3>
            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500/80 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
              Online
            </p>
          </div>
        </div>
        <div className={cn("max-w-[320px] rounded-xl border px-3 py-2 text-[11px]", syncTone)}>
          <div className="flex items-center gap-2">
            <SyncIcon className={cn("h-3.5 w-3.5 shrink-0", syncState === 'polling' || syncState === 'connecting' ? 'animate-spin' : '')} />
            <span className="truncate">{syncMessage}</span>
          </div>
          {lastUpdatedAt && (
            <p className="mt-1 text-[10px] opacity-80">Ultima atualizacao: {lastUpdatedAt}</p>
          )}
        </div>
      </div>

      <div 
        ref={viewportRef}
        className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white/20"></div>
          </div>
        ) : (
          Object.entries(messageGroups).map(([date, msgs]) => (
            <div key={date} className="space-y-6">
              <div className="flex justify-center">
                <span className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                  {date}
                </span>
              </div>
              
              <div className="space-y-4 flex flex-col">
                {msgs.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col group transition-all duration-300 transform",
                      msg.message.type === 'human' ? "items-end ml-12" : "items-start mr-12"
                    )}
                  >
                    <div
                      className={cn(
                        "relative px-4 py-3 text-sm shadow-xl transition-all duration-300 group-hover:scale-[1.01]",
                        msg.message.type === 'human'
                          ? "bg-[#1d1d1f] text-zinc-100 rounded-2xl rounded-tr-[2px] ring-1 ring-white/10"
                          : "bg-white/5 text-zinc-300 rounded-2xl rounded-tl-[2px] border border-white/5 backdrop-blur-sm"
                      )}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {msg.message.content || 'Mensagem sem conteúdo'}
                      </p>
                    </div>
                    
                    <div className={cn(
                      "mt-1.5 flex items-center gap-2 text-[10px] text-zinc-600 transition-opacity",
                      msg.message.type === 'human' ? "flex-row-reverse" : "flex-row"
                    )}>
                      {msg.hora_data_mensagem && (
                        <span>
                          {format(new Date(msg.hora_data_mensagem), 'HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-[#0a0a0a] border-t border-[#1f1f1f]">
        <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600 bg-white/5 py-3 rounded-xl border border-white/5 italic">
          <AlertCircle className="w-3 h-3" />
          <span>O painel é apenas para visualização. As respostas são geradas pelo n8n.</span>
        </div>
      </div>
    </div>
  );
}
