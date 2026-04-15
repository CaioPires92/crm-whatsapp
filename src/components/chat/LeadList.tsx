import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchEvolutionChats, fetchEvolutionLabels, getLeadContactPhone, getLeadDisplayName, isEvolutionConfigured, normalizeLeadId, getCanonicalKey } from '../../lib/evolution';
import type { LeadListItem, ChatLead } from '../../types/lead';
import { Search, User as UserIcon, RefreshCw, AlertTriangle, Radio, SlidersHorizontal } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Label {
  id: string;
  name: string;
  color: string;
}

interface LeadListProps {
  onSelectLead: (lead: ChatLead) => void;
  selectedLeadId?: string;
}

type SyncState = 'connecting' | 'realtime' | 'polling' | 'error' | 'idle';

function formatLeadTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  if (isNaN(date.getTime())) return '';

  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';

  return date.toLocaleDateString('pt-BR');
}

function getLabelHue(value: string | null | undefined) {
  const parsed = parseInt(value || '0', 10);
  return isNaN(parsed) ? 150 : parsed * 40;
}

function getLabelTheme(value: string | null | undefined, active = false) {
  const hue = getLabelHue(value);
  return active
    ? {
      backgroundColor: `hsla(${hue}, 62%, 54%, 0.16)`,
      borderColor: `hsla(${hue}, 68%, 62%, 0.30)`,
      color: `hsl(${hue}, 80%, 86%)`,
    }
    : {
      backgroundColor: `hsla(${hue}, 38%, 42%, 0.10)`,
      borderColor: `hsla(${hue}, 44%, 58%, 0.18)`,
      color: `hsl(${hue}, 62%, 78%)`,
    };
}

function getLabelDotStyle(value: string | null | undefined) {
  const hue = getLabelHue(value);
  return {
    backgroundColor: `hsl(${hue}, 68%, 58%)`,
  };
}

function getLeadFallbackText(lead: LeadListItem) {
  if (lead.last_message_preview) return lead.last_message_preview;
  const phone = lead.telefone || getLeadContactPhone(lead.lead_id, lead.remote_jid);
  if (phone) return phone;
  return 'Toque para abrir a conversa';
}

function getPicHash(url?: string | null) {
  if (!url) return null;
  try {
    return new URL(url).pathname;
  } catch (e) {
    return url.split('?')[0];
  }
}

export default function LeadList({ onSelectLead, selectedLeadId }: LeadListProps) {
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | 'all'>('all');
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>('connecting');
  const [syncMessage, setSyncMessage] = useState('Sincronizando...');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const filtersScrollRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ isDragging: boolean; startX: number; startScrollLeft: number }>({
    isDragging: false, startX: 0, startScrollLeft: 0,
  });

  const fetchLeads = async (mounted = true) => {
    if (!isEvolutionConfigured()) {
      setSyncState('error');
      setSyncMessage('Evolution API nao configurada.');
      setLoading(false);
      return;
    }

    try {
      const [
        { data: leadsData, error: leadsError },
        evolutionChats,
        evolutionLabels
      ] = await Promise.all([
        supabase.from('leads').select('*'),
        fetchEvolutionChats(200).catch(() => []),
        fetchEvolutionLabels().catch(() => [])
      ]);

      if (leadsError) throw leadsError;

      // Desduplica contatos vindos da Evolution API (ex: @lid vs @s.whatsapp.net)
      const uniqueEvolutionChats = new Map<string, typeof evolutionChats[0]>();

      const allChats = evolutionChats || [];
      const stdChats = allChats.filter(c => !c.remoteJid.includes('@lid'));
      const lidChats = allChats.filter(c => c.remoteJid.includes('@lid'));

      // Prioriza salvar os contatos padrões
      stdChats.forEach(chat => {
        const canonical = getCanonicalKey(chat.remoteJid) || chat.remoteJid;
        uniqueEvolutionChats.set(canonical, chat);
      });

      // Tenta fazer o merge dos chats de @lid (geralmente trazem o nome salvo/perfil) com os contatos padrões
      lidChats.forEach(lidChat => {
        const lidPic = getPicHash(lidChat.profilePicUrl);

        const matchedStdCanonical = stdChats.find(std => {
          const stdPic = getPicHash(std.profilePicUrl);
          const samePic = stdPic && lidPic && stdPic === lidPic;

          // Timestamp rígido de 5 segundos se não houver foto. Mas se tiver mesma foto, é a mesma pessoa.
          const sameTime = std.updatedAt && lidChat.updatedAt && Math.abs(new Date(std.updatedAt).getTime() - new Date(lidChat.updatedAt).getTime()) < 5000;

          return samePic || sameTime;
        });

        if (matchedStdCanonical) {
          // Funde as propriedades ricas do LID para o STD correspondente já salvo
          const canonical = getCanonicalKey(matchedStdCanonical.remoteJid) || matchedStdCanonical.remoteJid;
          const existing = uniqueEvolutionChats.get(canonical)!;
          existing.pushName = existing.pushName || lidChat.pushName;
          existing.name = existing.name || lidChat.name;
          uniqueEvolutionChats.set(canonical, existing);
        } else {
          // Se for um contato puramente @lid (CTWA) sem versão STD, salva ele sozinho
          uniqueEvolutionChats.set(lidChat.remoteJid, lidChat);
        }
      });

      const deduplicatedEvolutionChats = Array.from(uniqueEvolutionChats.values());

      // Fonte de Verdade: Evolution API (Chats ativos)
      const merged = deduplicatedEvolutionChats.map((chat): LeadListItem => {
        const canonicalId = getCanonicalKey(chat.remoteJid);
        // O DB match existe apenas para pegar a etapa do Kanban (funil) e labels se preciso
        const dbMatch = (leadsData || []).find(l =>
          getCanonicalKey(l.lead_id) === canonicalId ||
          (l.telefone && chat.remoteJid.includes(l.telefone))
        );

        const lead: LeadListItem = {
          id: dbMatch?.id || -Math.floor(Math.random() * 1000000),
          lead_id: normalizeLeadId(chat.remoteJid),
          whatsapp_name: chat.pushName || null,   // 100% Evolution
          contact_name: chat.name || null,        // 100% Evolution
          telefone: getLeadContactPhone(chat.remoteJid) || null, // 100% Evolution
          remote_jid: chat.remoteJid,
          labels: chat.labels && chat.labels.length > 0 ? chat.labels : (dbMatch?.labels || []),
          etapa: dbMatch?.etapa || 'Inbox', // Kanban vem do BD
          created_at: chat.updatedAt || new Date().toISOString(), // 100% Evolution
          last_message_at: chat.updatedAt || null, // 100% Evolution
          avatar_url: chat.profilePicUrl || null, // 100% Evolution
          hospede_nome: '' // Placeholder
        };

        // Calcula o nome de exibição baseado na hierarquia: Agenda > WhatsApp > Fone
        lead.hospede_nome = getLeadDisplayName(lead);
        return lead;
      });

      if (mounted) {
        setLeads(merged);
        setAvailableLabels((evolutionLabels || []).filter((l: any) => l?.id));
        setLastUpdatedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        setSyncState('idle');
        setSyncMessage('Inbox atualizada via Evolution API.');
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
      if (mounted) {
        setSyncState('error');
        setSyncMessage('Erro na sincronização.');
      }
    } finally {
      if (mounted) setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    fetchLeads(mounted);

    const channel = supabase.channel('leads-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads(mounted))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setSyncState('realtime');
      });

    const intervalId = window.setInterval(() => fetchLeads(mounted), 45000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtros UI
  const filteredLeads = leads.filter(lead => {
    const term = search.toLowerCase();
    const matchesSearch =
      lead.hospede_nome.toLowerCase().includes(term) ||
      (lead.telefone && lead.telefone.includes(search)) ||
      lead.lead_id.includes(term);

    const labels = lead.labels || [];
    const matchesLabel = selectedLabel === 'all' || labels.some(l => l.id === selectedLabel);

    return matchesSearch && matchesLabel;
  }).sort((a, b) => {
    const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return timeB - timeA;
  });

  const allLabels = Array.from(
    [...availableLabels, ...leads.flatMap(l => l.labels || [])].reduce((acc, label) => {
      if (label?.id && !acc.has(label.id)) acc.set(label.id, label);
      return acc;
    }, new Map<string, Label>()).values()
  );

  const labelCounts = leads.reduce((acc, lead) => {
    (lead.labels || []).forEach(l => {
      if (l.id) acc.set(l.id, (acc.get(l.id) || 0) + 1);
    });
    return acc;
  }, new Map<string, number>());

  const syncTone = syncState === 'realtime' ? 'text-emerald-400' : syncState === 'error' ? 'text-red-400' : 'text-zinc-400';
  const SyncIcon = syncState === 'error' ? AlertTriangle : syncState === 'realtime' ? Radio : RefreshCw;

  return (
    <div className="w-[460px] h-full border-r border-[#1f1f1f] flex flex-col shrink-0 bg-[#0f0f0f]">
      <div className="border-b border-[#1f1f1f] bg-[#0f0f0f] px-4 pb-4 pt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Inbox</p>
            <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-white">Conversas</h2>
            <div className={cn("mt-2 flex items-center gap-2 text-[11px]", syncTone)}>
              <SyncIcon className={cn("h-3 w-3 shrink-0", syncState === 'connecting' ? 'animate-spin' : '')} />
              <span className="truncate">{syncMessage}</span>
              {lastUpdatedAt && <span className="text-zinc-500">· {lastUpdatedAt}</span>}
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-zinc-400">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
          <input
            type="text"
            placeholder="Buscar contato..."
            className="w-full rounded-full border border-[#1f1f1f] bg-white/5 pl-11 pr-4 py-3 text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-zinc-700 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {allLabels.length > 0 && (
          <div className="mt-4">
            <div 
              ref={filtersScrollRef}
              onWheel={(e) => {
                // Allows using vertical mouse wheel for horizontal scrolling
                if (filtersScrollRef.current) {
                  e.preventDefault();
                  filtersScrollRef.current.scrollLeft += e.deltaY;
                }
              }}
              onMouseDown={(e) => {
                dragStateRef.current = { isDragging: true, startX: e.pageX, startScrollLeft: filtersScrollRef.current?.scrollLeft || 0 };
              }}
              onMouseUp={() => { dragStateRef.current.isDragging = false; }}
              onMouseLeave={() => { dragStateRef.current.isDragging = false; }}
              onMouseMove={(e) => {
                if (!dragStateRef.current.isDragging || !filtersScrollRef.current) return;
                e.preventDefault();
                const x = e.pageX;
                const walk = (x - dragStateRef.current.startX) * 2;
                filtersScrollRef.current.scrollLeft = dragStateRef.current.startScrollLeft - walk;
              }}
              className="flex w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] cursor-grab active:cursor-grabbing"
            >
              <button
                onClick={() => setSelectedLabel('all')}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-all",
                  selectedLabel === 'all' ? "border-white/20 bg-white/10 text-white" : "border-white/5 bg-white/5 text-zinc-400"
                )}
              >
                Tudo ({leads.length})
              </button>
              {allLabels.map(label => (
                <button
                  key={label.id}
                  onClick={() => setSelectedLabel(label.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-all",
                    selectedLabel === label.id ? "border-current opacity-100" : "border-white/5 opacity-60"
                  )}
                  style={getLabelTheme(label.color, selectedLabel === label.id)}
                >
                  {label.name} ({labelCounts.get(label.id) || 0})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-[#0a0a0a] px-2 py-3 space-y-1.5">
        {loading ? (
          <div className="p-8 text-center text-xs text-zinc-500 animate-pulse">Sincronizando WhatsApp...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">Nenhum retorno da Evolution API</div>
        ) : (
          filteredLeads.map((lead) => (
            <button
              key={lead.remote_jid || lead.lead_id || lead.id}
              onClick={() => onSelectLead(lead)}
              className={cn(
                "w-full flex items-center gap-3 rounded-2xl border px-3 py-4 transition-all duration-150 text-left",
                normalizeLeadId(selectedLeadId) === lead.lead_id
                  ? "border-white/15 bg-white/10 shadow-lg"
                  : "border-transparent bg-transparent hover:bg-white/[0.03]"
              )}
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-800">
                {lead.avatar_url ? (
                  <>
                    <img
                      src={lead.avatar_url}
                      alt={lead.hospede_nome}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.querySelector('svg')?.classList.remove('hidden'); }}
                    />
                    <UserIcon className="h-5 w-5 text-zinc-600 hidden" />
                  </>
                ) : (
                  <UserIcon className="h-5 w-5 text-zinc-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-white">
                      {lead.hospede_nome}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-zinc-500">
                      {getLeadFallbackText(lead)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {lead.etapa && lead.etapa !== 'Inbox' && (
                        <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[9px] font-bold text-blue-400 uppercase tracking-wider">
                          {lead.etapa}
                        </span>
                      )}
                      {lead.labels?.slice(0, 2).map(l => (
                        <span key={l.id} className="rounded-full px-2 py-0.5 text-[9px] font-medium" style={getLabelTheme(l.color, false)}>
                          {l.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 text-[11px] text-zinc-600">
                    {formatLeadTime(lead.last_message_at)}
                    {lead.etapa === 'Inbox' && <Radio className="h-2 w-2 text-emerald-500 animate-pulse" />}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
