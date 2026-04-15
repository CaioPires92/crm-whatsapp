import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchEvolutionMessages, getEvolutionConfig, getLeadContactPhone, getLeadDisplayName, normalizeLeadId, getCanonicalKey } from '../../lib/evolution';
import type { ChatLead } from '../../types/lead';
import { format, isToday, isYesterday, isSameYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User, MessageSquare, Radio, RefreshCw, AlertTriangle, Send, Bot, BotOff } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: number | string;
  session_id: string;
  message: {
    type: 'human' | 'ai' | 'sent' | 'received' | 'string';
    content: string;
  };
  hora_data_mensagem: string | null;
  status?: 'sending' | 'error' | 'sent';
}

interface ChatAreaProps {
  lead?: ChatLead;
  globalAiEnabled?: boolean;
}

type SyncState = 'idle' | 'connecting' | 'realtime' | 'polling' | 'error';

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

  const fetchMessages = useCallback(async (isInitial = false) => {
    if (!lead) return;
    if (isInitial) setLoading(true);

    const currentLeadId = normalizeLeadId(lead.lead_id);
    const canonicalId = getCanonicalKey(lead.lead_id);

    // IDs possíveis para busca no banco (tolerância a @lid e @s.whatsapp.net)
    const possibleIds = Array.from(new Set([
      lead.remote_jid,
      lead.lead_id,
      currentLeadId,
      `${currentLeadId}@s.whatsapp.net`,
      `${currentLeadId}@lid`,
    ].filter(Boolean) as string[]));

    try {
      // 1. Buscar no Evolution (Mensagens na API)
      const evolutionDataPromise = fetchEvolutionMessages(lead.remote_jid || lead.lead_id).catch(() => []);

      // 2. Buscar no Supabase DB (Fallback histórico)
      const dbDataPromise = (async () => {
        try {
          const { data, error } = await supabase
            .from('n8n_chat_histories')
            .select('*')
            .in('session_id', possibleIds)
            .order('hora_data_mensagem', { ascending: false })
            .limit(100);
          
          if (error) throw error;
          return { data };
        } catch (err) {
          console.error('DB fetch error:', err);
          return { data: [] };
        }
      })();

      const [evolutionData, dbResponse] = await Promise.all([evolutionDataPromise, dbDataPromise]);
      const dbData = dbResponse?.data || [];

      // Padroniza as mensagens da Evolution
      const normalizedEvolution = evolutionData.map((msg: any) => ({
        id: msg.id || msg.key?.id || Math.random().toString(),
        session_id: lead.lead_id,
        message: typeof msg.message === 'object' ? msg.message : { type: 'received', content: msg.message },
        hora_data_mensagem: msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000).toISOString() : new Date().toISOString(),
        source: 'evolution'
      }));

      // Padroniza as mensagens do Banco (Supabase)
      const normalizedDb = dbData.map((msg: any) => ({
        ...msg,
        source: 'db'
      }));

      setMessages(prev => {
        // Prioridade 1: Mensagens locais em envio (Optimistic UI)
        const localOnly = prev.filter(m => m.status === 'sending' || m.status === 'error').map(m => ({ ...m, source: 'local' }));

        const result: any[] = [...normalizedEvolution, ...localOnly];

        // Adiciona as do Banco de Dados APENAS se elas não estiverem na Evolution
        // (Isso previne duplicatas sem deletar mensagens repetidas verdadeiras vindas do WhatsApp)
        normalizedDb.forEach((dbMsg: any) => {
          const dbTime = dbMsg.hora_data_mensagem ? new Date(dbMsg.hora_data_mensagem).getTime() : 0;
          const dbContent = dbMsg.message?.content?.trim();

          const isAlreadyInEvolution = normalizedEvolution.some((evoMsg: any) => {
            const evoTime = evoMsg.hora_data_mensagem ? new Date(evoMsg.hora_data_mensagem).getTime() : 0;
            const evoContent = evoMsg.message?.content?.trim();
            // Considera a mesma mensagem se tiver o mesmo texto, mesmo tipo e ocorreu em um intervalo de 2 minutos
            return evoContent === dbContent && 
                   evoMsg.message?.type === dbMsg.message?.type &&
                   Math.abs(evoTime - dbTime) < 120000;
          });

          if (!isAlreadyInEvolution) {
            result.push(dbMsg);
          }
        });

        // Ordena tudo pelo tempo
        result.sort((a, b) => {
          const tA = a.hora_data_mensagem ? new Date(a.hora_data_mensagem).getTime() : 0;
          const tB = b.hora_data_mensagem ? new Date(b.hora_data_mensagem).getTime() : 0;
          return tA - tB;
        });

        return result;
      });

      setSyncState('idle');
      setLastUpdatedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      setSyncMessage('Sincronizado');
    } catch (err) {
      console.error('Error fetching messages:', err);
      setSyncState('error');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [lead]);

  useEffect(() => {
    if (!lead) {
      setMessages([]);
      setSyncState('idle');
      return;
    }

    fetchMessages(true);
    setIsChatbotAtivo(globalAiEnabled);

    const currentLeadId = normalizeLeadId(lead.lead_id);
    const channel = supabase.channel(`chat-realtime-${currentLeadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'n8n_chat_histories'
      }, (payload) => {
        const newMsg = payload.new as any;
        if (normalizeLeadId(newMsg.session_id) === currentLeadId) {
          fetchMessages(); // Refresh total para garantir consistência
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setSyncState('realtime');
      });

    const interval = setInterval(() => fetchMessages(), 15000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [lead, fetchMessages, globalAiEnabled]);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    msgs.forEach((msg) => {
      if (!msg.hora_data_mensagem) return;
      const date = new Date(msg.hora_data_mensagem);
      let dateKey = '';
      if (isToday(date)) dateKey = 'Hoje';
      else if (isYesterday(date)) dateKey = 'Ontem';
      else if (isSameYear(date, new Date())) dateKey = format(date, "dd 'de' MMMM", { locale: ptBR });
      else dateKey = format(date, "dd/MM/yyyy", { locale: ptBR });

      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(msg);
    });
    return groups;
  };

  if (!lead) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-[#0a0a0a] text-zinc-500">
        <MessageSquare className="w-12 h-12 mb-4 opacity-10" />
        <p className="text-sm font-medium tracking-tight">Selecione uma conversa</p>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);
  const displayName = lead.hospede_nome || lead.lead_nome || 'Hóspede sem nome';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="h-16 border-b border-[#1f1f1f] flex items-center justify-between px-6 bg-[#0a0a0a]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/5 overflow-hidden">
            {lead.avatar_url ? (
              <>
                <img
                  src={lead.avatar_url}
                  alt={displayName}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.querySelector('svg')?.classList.remove('hidden'); }}
                />
                <User className="w-5 h-5 m-2.5 text-zinc-600 hidden" />
              </>
            ) : (
              <User className="w-5 h-5 m-2.5 text-zinc-600" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">{displayName}</h3>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              {lead.telefone || 'WhatsApp'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-tighter transition-all",
            syncState === 'realtime' ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-white/5 bg-white/5 text-zinc-500"
          )}>
            <Radio className={cn("h-3 w-3", syncState === 'connecting' && "animate-spin")} />
            {syncState === 'realtime' ? "Tempo Real" : "Sincronizando"}
          </div>

          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-tighter",
            isChatbotAtivo ? "border-sky-500/20 bg-sky-500/10 text-sky-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"
          )}>
            {isChatbotAtivo ? <Bot className="h-3 w-3" /> : <BotOff className="h-3 w-3" />}
            {isChatbotAtivo ? "IA Ativa" : "IA Pausada"}
          </div>
        </div>
      </div>

      {/* Messages Viewport */}
      <div ref={viewportRef} className="flex-1 overflow-y-auto p-6 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-xs animate-pulse">Carregando histórico...</div>
        ) : (
          Object.entries(messageGroups).map(([date, msgs]) => (
            <div key={date} className="space-y-6">
              <div className="flex justify-center">
                <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{date}</span>
              </div>
              <div className="flex flex-col space-y-3">
                {msgs.map((msg) => {
                  const isMine = msg.message.type === 'sent' || msg.message.type === 'human' || msg.message.type === 'ai';
                  return (
                    <div key={msg.id} className={cn("flex flex-col", isMine ? "items-end ml-12" : "items-start mr-12")}>
                      <div className={cn(
                        "px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-sm",
                        isMine
                          ? "bg-[#1d1d1f] text-white rounded-tr-sm border border-white/5"
                          : "bg-white/5 text-zinc-300 rounded-tl-sm border border-white/5"
                      )}>
                        {msg.message.content}
                      </div>
                      <div className="mt-1 px-1 flex items-center gap-1.5 text-[10px] text-zinc-600 font-medium">
                        {msg.hora_data_mensagem && format(new Date(msg.hora_data_mensagem), 'HH:mm')}
                        {msg.status === 'sending' && <RefreshCw className="h-2 w-2 animate-spin" />}
                        {msg.message.type === 'ai' && <Bot className="h-2 w-2 text-sky-500/50" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer / Input */}
      <div className="p-4 bg-[#0a0a0a] border-t border-[#1f1f1f]">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newMessage.trim() || sending) return;

            const text = newMessage.trim();
            setNewMessage('');
            setSending(true);

            // Optimistic UI
            const tempId = `temp-${Date.now()}`;
            const tempMsg: Message = {
              id: tempId,
              session_id: lead.lead_id,
              message: { type: 'human', content: text },
              hora_data_mensagem: new Date().toISOString(),
              status: 'sending'
            };
            setMessages(prev => [...prev, tempMsg]);

            try {
              const { url, instance, apiKey } = getEvolutionConfig();

              if (!url || !instance || !apiKey) {
                throw new Error('Evolution config is missing');
              }

              const res = await fetch(`${url}/message/sendText/${instance}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify({
                  number: lead.lead_id.includes('@') ? lead.lead_id : `${lead.lead_id}@s.whatsapp.net`,
                  text,
                  delay: 500
                })
              });
              if (!res.ok) throw new Error('Send failed');

              // Persist locally for immediate feedback while n8n catches up
              await supabase.from('n8n_chat_histories').insert({
                session_id: lead.lead_id,
                message: { type: 'human', content: text },
                hora_data_mensagem: new Date().toISOString()
              });

              setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
            } catch (err) {
              console.error(err);
              setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
            } finally {
              setSending(false);
            }
          }}
          className="flex gap-2"
        >
          <input
            className="flex-1 bg-white/5 border border-[#1f1f1f] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/10 transition-all"
            placeholder={isChatbotAtivo ? "IA Ativa... digite para assumir" : "Digite sua mensagem..."}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all disabled:opacity-30"
          >
            {sending ? <RefreshCw className="h-4 w-4 animate-spin text-white" /> : <Send className="h-4 w-4 text-white" />}
          </button>
        </form>
      </div>
    </div>
  );
}
