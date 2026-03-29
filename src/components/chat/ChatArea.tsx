import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { format, isToday, isYesterday, isSameYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, MessageSquare, AlertCircle } from 'lucide-react';
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

export default function ChatArea({ lead }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lead) return;

    setLoading(true);
    fetchMessages();

    const channel = supabase
      .channel(`chat-${lead.lead_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'n8n_chat_histories',
          filter: `session_id=eq.${lead.lead_id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
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

  async function fetchMessages() {
    if (!lead) return;
    const { data, error } = await supabase
      .from('n8n_chat_histories')
      .select('*')
      .eq('session_id', lead.lead_id)
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  }

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
