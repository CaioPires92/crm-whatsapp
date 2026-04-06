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
    type: 'human' | 'ai' | 'sent' | 'received';
    content: string;
  };
  hora_data_mensagem: string | null;
  status?: 'sending' | 'error' | 'sent';
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
    const currentLeadId = normalizeLeadId(lead.lead_id);
    const possibleRemoteJids = Array.from(
      new Set(
        [
          lead.remote_jid,
          lead.lead_id,
          `${currentLeadId}@s.whatsapp.net`,
          `${currentLeadId}@lid`,
          `${currentLeadId}@c.us`,
        ].filter(Boolean) as string[]
      )
    );

    const fetchMessages = async (forceFull = false) => {
      // Se já temos mensagens e não é um carregamento forçado, 
      // podemos opcionalmente pular a busca pesada da Evolution API se o tempo de resposta do Supabase for bom.
      // Por enquanto, manteremos a busca unificada mas com tratamento para evitar flickering.
      
      const supabaseQuery = supabase
        .from('n8n_chat_histories')
        .select('*')
        .or(possibleRemoteJids.map((jid) => `session_id.eq.${jid}`).join(','))
        .order('hora_data_mensagem', { ascending: true });

      const evolutionPromises = forceFull ? possibleRemoteJids.map(jid => 
        fetchEvolutionMessages(jid).catch((err) => {
          console.debug(`Falha silenciosa ao buscar Evolution for ${jid}:`, err);
          return [] as Message[];
        })
      ) : [];

      const [supabaseRes, ...evolutionResults] = await Promise.all([
        supabaseQuery,
        ...evolutionPromises
      ]);

      if (supabaseRes.error) {
        console.error('Error fetching messages from Supabase:', supabaseRes.error);
        if (mounted) {
          setSyncState('error');
          setSyncMessage('Nao foi possivel carregar o historico do banco.');
        }
      } else if (mounted) {
        const supabaseMessages = (supabaseRes.data || []).map(msg => {
          // Normalização: se 'message' for objeto, extrair content; se for string, usar direto.
          const isObject = typeof msg.message === 'object' && msg.message !== null;
          return {
            ...msg,
            message: {
              type: msg.type || msg.message?.type || 'received',
              content: isObject ? (msg.message.content || msg.message.text || '') : (msg.message || '')
            },
            // Garantir que temos um horario
            hora_data_mensagem: msg.hora_data_mensagem || msg.created_at
          } as Message;
        });

        const evolutionRaw = evolutionResults.flat() as any[];
        const evolutionMessages = evolutionRaw.map(msg => ({
          ...msg,
          // Garantir formato esperado pela UI
          message: typeof msg.message === 'object' ? msg.message : { type: 'received', content: msg.message }
        })) as Message[];

        // Função auxiliar para assinatura tolerante a tempo (precisão de 1 minuto)
        const getMsgSig = (m: Message) => {
          const dateStr = m.hora_data_mensagem ? format(new Date(m.hora_data_mensagem), 'yyyy-MM-dd HH:mm') : 'no-date';
          return `${m.message.content}-${m.message.type}-${dateStr}`;
        };

        setMessages(prev => {
          // Unificar e De-duplicar mantendo as mensagens 'sending'/'sent' locais
          const seen = new Set<string>();
          
          // Filtramos mensagens otimistas que ainda não foram substituídas por registros de rídigo (banco)
          const localMessages = prev.filter(m => m.status === 'sending' || m.status === 'sent');
          
          const combined = [...supabaseMessages, ...evolutionMessages, ...localMessages].reduce((acc, msg) => {
            const signature = getMsgSig(msg);
            
            // Se já temos a mensagem confirmada vinda do banco ou evolution, 
            // e ela bate com a assinatura de uma local, priorizamos a do banco
            if (!seen.has(signature)) {
              seen.add(signature);
              acc.push(msg);
            }
            return acc;
          }, [] as Message[]).sort((a, b) => {
            const timeA = a.hora_data_mensagem ? new Date(a.hora_data_mensagem).getTime() : 0;
            const timeB = b.hora_data_mensagem ? new Date(b.hora_data_mensagem).getTime() : 0;
            return timeA - timeB;
          });
          
          return combined;
        });

        setSyncMessage(
          supabaseRes.data?.length ? 'Mensagens sincronizadas.' : 'Nenhuma mensagem encontrada.'
        );

        setLastUpdatedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        setSyncState((current) => (current === 'error' ? 'polling' : current));
      }
      if (mounted) {
        setLoading(false);
      }
    };

    // Carregamento inicial reforçado (Full Sync)
    fetchMessages(true);
    
    // Polling de segurança (mais espaçado agora que o realtime está otimizado)
    const intervalId = window.setInterval(() => fetchMessages(false), 30000);

    const channel = supabase
      .channel(`chat-${currentLeadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'n8n_chat_histories',
        },
        (payload: any) => {
          const newMsg = payload.new as Message;
          const payloadSessionId = normalizeLeadId(newMsg?.session_id);
          
          if (payloadSessionId === currentLeadId && payload.eventType === 'INSERT') {
            const rawMsg = payload.new;
            if (!rawMsg) return;
            
            const isObj = typeof rawMsg.message === 'object' && rawMsg.message !== null;
            const normalizedNewMsg: Message = {
              ...rawMsg,
              message: {
                type: rawMsg.type || (isObj ? rawMsg.message?.type : null) || 'received',
                content: isObj ? (rawMsg.message.content || rawMsg.message.text || '') : (rawMsg.message || '')
              },
              hora_data_mensagem: rawMsg.hora_data_mensagem || rawMsg.created_at
            };

            setMessages(prev => {
              // Função de assinatura interna para o listener
              const getSig = (m: Message) => {
                const dateStr = m.hora_data_mensagem ? format(new Date(m.hora_data_mensagem), 'yyyy-MM-dd HH:mm') : 'no-date';
                return `${m.message.content}-${m.message.type}-${dateStr}`;
              };
              
              const newMsgSig = getSig(normalizedNewMsg);
              const alreadyExists = prev.some(m => !m.status && getSig(m) === newMsgSig);
              
              if (alreadyExists) return prev;
              
              // Substituição cirúrgica: Removemos APENAS uma mensagem local pendente que combine
              let replaced = false;
              const nextMessages = prev.filter(m => {
                if (!replaced && (m.status === 'sending' || m.status === 'sent') && getSig(m) === newMsgSig) {
                  replaced = true;
                  return false;
                }
                return true;
              });

              return [...nextMessages, normalizedNewMsg].sort((a, b) => {
                const tA = a.hora_data_mensagem ? new Date(a.hora_data_mensagem).getTime() : 0;
                const tB = b.hora_data_mensagem ? new Date(b.hora_data_mensagem).getTime() : 0;
                return tA - tB;
              });
            });
            setLastUpdatedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
          } else if (payloadSessionId === currentLeadId) {
            fetchMessages();
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          setSyncState('realtime');
          setSyncMessage('Mensagens chegando em tempo real.');
        } else if (!isCleaningUp && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')) {
          console.error(`Chat realtime channel failed for ${lead.lead_id}. Falling back to polling.`);
          setSyncState('polling');
          setSyncMessage('Realtime indisponível. Consultando novas mensagens periodicamente.');
        }
      });

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
        <div className="flex items-center gap-3">
          {/* Sync Status Badge (Discreet) */}
          <div 
            className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-medium transition-all duration-300", syncTone.replace('px-3 py-2 text-[11px]', ''))}
            title={`${syncMessage} (Última: ${lastUpdatedAt})`}
          >
            <SyncIcon className={cn("h-3 w-3", syncState === 'polling' || syncState === 'connecting' ? 'animate-spin' : '')} />
            <span className="hidden md:inline opacity-80 uppercase tracking-tighter">Sincronizado</span>
          </div>

          {/* Pilot Mode Badge (Discreet) */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter transition-all border",
              isChatbotAtivo
                ? "border-sky-500/10 text-sky-500/80"
                : "border-amber-500/10 text-amber-500/80"
            )}
            title={isChatbotAtivo ? "Piloto automático ativo" : "Modo manual ativo"}
          >
            {isChatbotAtivo ? <Bot className="w-3 h-3" /> : <BotOff className="w-3 h-3" />}
            <span>{isChatbotAtivo ? "Auto" : "Manual"}</span>
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
                      (msg.message.type === 'sent' || msg.message.type === 'human') ? "items-end ml-12" : "items-start mr-12"
                    )}
                  >
                    <div
                      className={cn(
                        "relative px-4 py-3 text-sm shadow-xl transition-all duration-300 group-hover:scale-[1.01]",
                        (msg.message.type === 'sent' || msg.message.type === 'human')
                          ? "bg-[#1d1d1f] text-zinc-100 rounded-2xl rounded-tr-[2px] ring-1 ring-white/10"
                          : "bg-white/5 text-zinc-300 rounded-2xl rounded-tl-[2px] border border-white/5 backdrop-blur-sm",
                        msg.status === 'sending' && "opacity-50 blur-[0.5px]",
                        msg.status === 'error' && "ring-1 ring-red-500/50 bg-red-500/5 text-red-200"
                      )}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {msg.message.content || 'Mensagem sem conteúdo'}
                      </p>
                      
                      {msg.status === 'sending' && (
                        <div className="absolute -bottom-4 right-0 flex items-center gap-1 text-[8px] text-zinc-500 uppercase tracking-tighter font-bold animate-pulse">
                          <span>Sincronizando</span>
                          <RefreshCw className="w-2 h-2 animate-spin" />
                        </div>
                      )}

                      {msg.status === 'error' && (
                        <div className="absolute -bottom-4 right-0 text-[8px] text-red-500 uppercase tracking-tighter font-bold">
                          Erro no envio
                        </div>
                      )}
                    </div>

                    <div className={cn(
                      "mt-1.5 flex items-center gap-2 text-[10px] text-zinc-600 transition-opacity",
                      (msg.message.type === 'sent' || msg.message.type === 'human') ? "flex-row-reverse" : "flex-row"
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

            const messageText = newMessage.trim();
            setNewMessage('');
            
            // --- OPTIMISTIC UI START ---
            const tempId = `temp-${Date.now()}`;
            const tempMessage: Message = {
              id: tempId,
              session_id: lead.lead_id,
              message: {
                type: 'sent',
                content: messageText
              },
              hora_data_mensagem: new Date().toISOString(),
              status: 'sending'
            };
            
            setMessages(prev => [...prev, tempMessage]);
            // --- OPTIMISTIC UI END ---

            setSending(true);

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

              await supabase.from('n8n_chat_histories').insert({
                session_id: lead.lead_id,
                message: {
                  type: 'sent',
                  content: messageText
                },
                hora_data_mensagem: new Date().toISOString()
              });

              // --- INSTANT CONFIRMATION ---
              // Assim que o insert termina, marcamos como sent localmente para sumir o 'Sincronizando'
              setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
              // Removemos o status 'sent' após 2 segundos (ou deixamos para o Realtime limpar)
              // Por segurança, o Realtime cuidará da limpeza final.

            } catch (err) {
              console.error('Erro no envio manual:', err);
              // Marcar mensagem como erro
              setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
              alert('Erro ao enviar mensagem. Recarregue a pagina ou tente novamente.');
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
        <div className="mt-2 flex items-center justify-center gap-1.5 text-[8px] text-zinc-700 uppercase tracking-widest font-bold">
          <span>{isChatbotAtivo ? "IA Ativa" : "IA Pausada"}</span>
          <span className="w-1 h-1 rounded-full bg-zinc-800" />
          <span>{isChatbotAtivo ? "Resposta automática ligada" : "Responda manualmente por aqui"}</span>
        </div>
      </div>
    </div>
  );
}
