import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchEvolutionMessages, getLeadContactPhone, getLeadDisplayName, normalizeLeadId } from '../../lib/evolution';
import { format, isToday, isYesterday, isSameYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, MessageSquare, AlertCircle, Radio, RefreshCw, AlertTriangle, Send, Bot, BotOff } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: number | string;
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
    id: number;
    remote_jid?: string;
    avatar_url?: string | null;
  };
  globalAiEnabled?: boolean;
}

type SyncState = 'idle' | 'connecting' | 'realtime' | 'polling' | 'error';

function hasUsefulLeadName(value: string | null | undefined) {
  const normalizedName = (value || '').trim().toLowerCase();
  return Boolean(normalizedName && normalizedName !== '.' && normalizedName !== 'sem nome');
}

export default function ChatArea({ lead, globalAiEnabled = true }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncMessage, setSyncMessage] = useState('Selecione uma conversa para sincronizar.');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isChatbotAtivo, setIsChatbotAtivo] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lead) {
      setMessages([]);
      setLoading(false);
      setSyncState('idle');
      setSyncMessage('Selecione uma conversa para acompanhar as mensagens.');
      setLastUpdatedAt(null);
      setIsChatbotAtivo(globalAiEnabled);
      return;
    }

    setIsChatbotAtivo(globalAiEnabled);

    let mounted = true;
    let isCleaningUp = false;
    const normalizedLeadId = normalizeLeadId(lead.lead_id);
    const possibleRemoteJids = Array.from(
      new Set(
        [
          lead.remote_jid,
          lead.lead_id,
          `${normalizedLeadId}@s.whatsapp.net`,
          `${normalizedLeadId}@lid`,
          `${normalizedLeadId}@c.us`,
        ].filter(Boolean) as string[]
      )
    );

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('n8n_chat_histories')
        .select('*')
        .or(possibleRemoteJids.map((jid) => `session_id.eq.${jid}`).join(','))
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        if (mounted) {
          setSyncState('error');
          setSyncMessage('Nao foi possivel carregar mensagens novas. Confira sua sessao ou as politicas do Supabase.');
        }
      } else if (mounted) {
        const supabaseMessages = data || [];

        if (supabaseMessages.length > 0) {
          setMessages(supabaseMessages);
          setSyncMessage('Historico sincronizado pelo Supabase.');
        } else {
          let evolutionMessages: Message[] = [];

          for (const remoteJid of possibleRemoteJids) {
            try {
              evolutionMessages = await fetchEvolutionMessages(remoteJid);
              if (evolutionMessages.length > 0) {
                break;
              }
            } catch (evolutionError) {
              console.error(`Error fetching messages from Evolution for ${remoteJid}:`, evolutionError);
            }
          }

          setMessages(evolutionMessages);
          setSyncMessage(
            evolutionMessages.length > 0
              ? 'Historico carregado via Evolution API.'
              : 'Nenhuma mensagem encontrada para esta conversa.'
          );
        }

        setLastUpdatedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        setSyncState((current) => (current === 'error' ? 'polling' : current));
      }

      if (mounted) {
        setLoading(false);
      }
    };

    setSyncState('connecting');
    setSyncMessage('Conectando com a conversa...');
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
          const payloadSessionId = normalizeLeadId((payload.new as Message | undefined)?.session_id || (payload.old as Message | undefined)?.session_id);
          if (payloadSessionId === normalizedLeadId) {
            fetchMessages();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setSyncState('realtime');
          setSyncMessage('Mensagens chegando em tempo real.');
        } else if (!isCleaningUp && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')) {
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
      isCleaningUp = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowRefresh);
      document.removeEventListener('visibilitychange', handleWindowRefresh);
      supabase.removeChannel(channel);
    };
  }, [lead, globalAiEnabled]);

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
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1d1d1d] to-[#121212] flex items-center justify-center text-zinc-400 border border-[#1f1f1f] overflow-hidden">
            {lead.avatar_url ? (
              <img
                src={lead.avatar_url}
                alt={getLeadDisplayName(lead.lead_nome, lead.lead_id, lead.remote_jid)}
                className="h-full w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">
              {getLeadDisplayName(lead.lead_nome, lead.lead_id, lead.remote_jid)}
            </h3>
            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500/80 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
              {hasUsefulLeadName(lead.lead_nome)
                ? 'Online'
                : getLeadContactPhone(lead.lead_id, lead.remote_jid)
                  ? 'Telefone identificado'
                  : 'Sem telefone identificado'}
            </p>
          </div>
        </div>
        <div className={cn("max-w-[320px] rounded-xl border px-3 py-2 text-[11px]", syncTone)}>
          <div className="flex items-center gap-2">
            <SyncIcon className={cn("h-3.5 w-3.5 shrink-0", syncState === 'polling' || syncState === 'connecting' ? 'animate-spin' : '')} />
            <span className="truncate">{syncMessage}</span>
          </div>
          <div className="mt-1 text-[10px] opacity-80">Ultima atualizacao: {lastUpdatedAt}</div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
              isChatbotAtivo
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
            )}
            title={isChatbotAtivo ? "Piloto automatico ativo" : "Modo manual ativo"}
          >
            {isChatbotAtivo ? <Bot className="w-3.5 h-3.5" /> : <BotOff className="w-3.5 h-3.5" />}
            {isChatbotAtivo ? "Piloto Automatico" : "Modo Manual"}
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
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newMessage.trim() || sending) return;

            setSending(true);
            const messageText = newMessage.trim();
            setNewMessage('');

            try {
              const res = await fetch(`${import.meta.env.VITE_EVOLUTION_URL}/message/sendText/${import.meta.env.VITE_EVOLUTION_INSTANCE}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': import.meta.env.VITE_EVOLUTION_API_KEY
                },
                body: JSON.stringify({
                  number: lead.lead_id.includes('@') ? lead.lead_id : `${lead.lead_id}@s.whatsapp.net`,
                  text: messageText,
                  delay: 1200
                })
              });

              if (!res.ok) throw new Error('Falha ao enviar mensagem');

              // Optamos por salvar no histórico imediatamente para melhorar UX
              await supabase.from('n8n_chat_histories').insert({
                session_id: lead.lead_id,
                message: {
                  type: 'human',
                  content: messageText
                },
                hora_data_mensagem: new Date().toISOString()
              });

            } catch (err) {
              console.error('Erro no envio manual:', err);
              alert('Erro ao enviar mensagem. Verifique a conexao.');
            } finally {
              setSending(false);
            }
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder={isChatbotAtivo ? "IA está ativa. Digite para assumir manualmente..." : "IA pausada. Digite sua resposta..."}
            className="flex-1 bg-white/5 border border-[#1f1f1f] rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700 transition-all"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all disabled:opacity-50"
          >
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
        <div className="mt-3 flex items-center justify-center gap-2 text-[9px] text-zinc-600 bg-white/5 py-1.5 rounded-lg border border-white/5 italic">
          <AlertCircle className="w-2.5 h-2.5" />
          <span>{isChatbotAtivo ? "O chatbot responderá automaticamente as novas mensagens." : "O chatbot está pausado para este lead. Responda manualmente."}</span>
        </div>
      </div>
    </div>
  );
}
