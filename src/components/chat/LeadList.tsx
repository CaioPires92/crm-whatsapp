import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchEvolutionChats, fetchEvolutionLabels, getLeadContactPhone, getLeadDisplayName, isEvolutionConfigured, isLikelyInternalWhatsAppId, isLikelyPhoneNumber, normalizeLeadId } from '../../lib/evolution';
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

interface Lead {
  id: number;
  lead_nome: string;
  lead_id: string;
  created_at: string;
  labels?: Label[];
  last_message_at?: string | null;
  last_message_preview?: string | null;
  remote_jid?: string;
  avatar_url?: string | null;
}

interface LeadListProps {
  onSelectLead: (lead: Lead) => void;
  selectedLeadId?: string;
}

type SyncState = 'connecting' | 'realtime' | 'polling' | 'error';

function getLeadPriority(lead: Lead) {
  const hasUsefulName = !!lead.lead_nome && lead.lead_nome !== '.' && lead.lead_nome.toLowerCase() !== 'sem nome';
  const createdAt = lead.created_at ? new Date(lead.created_at).getTime() : 0;
  const lastMessageAt = lead.last_message_at ? new Date(lead.last_message_at).getTime() : 0;

  return {
    hasUsefulName,
    lastMessageAt,
    createdAt,
    id: lead.id,
  };
}

function normalizeAvatarKey(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return value.split('?')[0];
  }
}

function mergeLeadData(base: Lead, incoming: Lead) {
  const preferred = choosePreferredLead(base, incoming);
  const fallback = preferred === base ? incoming : base;
  const preferredIsPhone = isLikelyPhoneNumber(preferred.lead_id);
  const fallbackIsPhone = isLikelyPhoneNumber(fallback.lead_id);

  return {
    ...preferred,
    lead_id: preferredIsPhone ? preferred.lead_id : fallbackIsPhone ? normalizeLeadId(fallback.lead_id) : preferred.lead_id,
    lead_nome: hasUsefulLeadName(preferred.lead_nome)
      ? preferred.lead_nome
      : hasUsefulLeadName(fallback.lead_nome)
        ? fallback.lead_nome
        : preferred.lead_nome,
    labels: Array.isArray(preferred.labels) && preferred.labels.length > 0
      ? preferred.labels
      : fallback.labels,
    last_message_preview: preferred.last_message_preview || fallback.last_message_preview || null,
    remote_jid: preferred.remote_jid || fallback.remote_jid,
    avatar_url: preferred.avatar_url || fallback.avatar_url || null,
  };
}

function choosePreferredLead(current: Lead, candidate: Lead) {
  const currentPriority = getLeadPriority(current);
  const candidatePriority = getLeadPriority(candidate);
  const currentIsPhone = isLikelyPhoneNumber(current.lead_id);
  const candidateIsPhone = isLikelyPhoneNumber(candidate.lead_id);

  if (candidatePriority.hasUsefulName && !currentPriority.hasUsefulName) {
    return { ...candidate, lead_id: normalizeLeadId(candidate.lead_id) };
  }

  if (candidateIsPhone && !currentIsPhone) {
    return { ...candidate, lead_id: normalizeLeadId(candidate.lead_id) };
  }

  if (candidatePriority.hasUsefulName === currentPriority.hasUsefulName) {
    if (candidatePriority.lastMessageAt > currentPriority.lastMessageAt) {
      return { ...candidate, lead_id: normalizeLeadId(candidate.lead_id) };
    }

    if (candidatePriority.lastMessageAt === currentPriority.lastMessageAt && candidatePriority.createdAt > currentPriority.createdAt) {
      return { ...candidate, lead_id: normalizeLeadId(candidate.lead_id) };
    }

    if (candidatePriority.createdAt > currentPriority.createdAt) {
      return { ...candidate, lead_id: normalizeLeadId(candidate.lead_id) };
    }

    if (candidatePriority.createdAt === currentPriority.createdAt && candidatePriority.id > currentPriority.id) {
      return { ...candidate, lead_id: normalizeLeadId(candidate.lead_id) };
    }
  }

  return current;
}

function getNormalizedLeadName(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getLeadNameTokens(value: string | null | undefined) {
  return getNormalizedLeadName(value)
    .split(' ')
    .filter((token) => token.length >= 3);
}

function getLeadMergeKeys(lead: Lead) {
  const normalizedLeadId = normalizeLeadId(lead.lead_id);
  const digits = normalizedLeadId.replace(/\D/g, '');
  const keys = new Set<string>();

  if (isLikelyPhoneNumber(normalizedLeadId)) {
    keys.add(`phone:${digits}`);
  }

  const avatarKey = normalizeAvatarKey(lead.avatar_url);
  if (avatarKey) {
    keys.add(`avatar:${avatarKey}`);

    const nameTokens = getLeadNameTokens(lead.lead_nome);
    if (nameTokens.length > 0) {
      keys.add(`avatar-name:${avatarKey}:${nameTokens[0]}`);
    }
  }

  if (hasUsefulLeadName(lead.lead_nome)) {
    keys.add(`name:${getNormalizedLeadName(lead.lead_nome)}`);
  }

  keys.add(`id:${normalizedLeadId}`);
  return Array.from(keys);
}

function getLeadFallbackText(lead: Lead) {
  if (lead.last_message_preview) {
    return lead.last_message_preview;
  }

  if (!hasUsefulLeadName(lead.lead_nome)) {
    const phone = getLeadContactPhone(lead.lead_id, lead.remote_jid);
    if (phone) {
      return phone;
    }

    if (isLikelyInternalWhatsAppId(lead.remote_jid || lead.lead_id)) {
      return 'Sem telefone identificado';
    }
  }

  return 'Toque para abrir a conversa';
}

function formatLeadTime(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const now = new Date();

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Ontem';
  }

  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - now.getDay());

  if (date >= startOfWeek) {
    return date.toLocaleDateString('pt-BR', { weekday: 'long' });
  }

  return date.toLocaleDateString('pt-BR');
}

function getLabelHue(value: string | null | undefined) {
  const parsed = Number.parseInt(value || '0', 10);
  return Number.isNaN(parsed) ? 150 : parsed * 40;
}

function getLabelTheme(value: string | null | undefined, active = false) {
  const hue = getLabelHue(value);

  return active
    ? {
        backgroundColor: `hsla(${hue}, 62%, 54%, 0.16)`,
        borderColor: `hsla(${hue}, 68%, 62%, 0.30)`,
        color: `hsl(${hue}, 80%, 86%)`,
        boxShadow: `inset 0 0 0 1px hsla(${hue}, 60%, 65%, 0.05)`,
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
    boxShadow: `0 0 0 1px hsla(${hue}, 30%, 18%, 0.55)`,
  };
}

function hasUsefulLeadName(value: string | null | undefined) {
  const normalizedName = (value || '').trim().toLowerCase();
  return Boolean(normalizedName && normalizedName !== '.' && normalizedName !== 'sem nome');
}

function getPreviewFromHistoryMessage(message: unknown) {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const candidate = (message as { content?: unknown }).content;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

export default function LeadList({ onSelectLead, selectedLeadId }: LeadListProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | 'all'>('all');
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>('connecting');
  const [syncMessage, setSyncMessage] = useState('Conectando com o Supabase...');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const filtersScrollRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ isDragging: boolean; startX: number; startScrollLeft: number }>({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
  });

  useEffect(() => {
    let mounted = true;
    let isCleaningUp = false;

    async function fetchLeads() {
      const evolutionChatsPromise = isEvolutionConfigured()
        ? fetchEvolutionChats(200).catch((error) => {
            console.error('Error fetching chats from Evolution:', error);
            return [];
          })
        : Promise.resolve([]);

      const evolutionLabelsPromise = isEvolutionConfigured()
        ? fetchEvolutionLabels().catch((error) => {
            console.error('Error fetching labels from Evolution:', error);
            return [];
          })
        : Promise.resolve([]);

      const [
        { data: leadsData, error: leadsError },
        { data: historyData, error: historyError },
        evolutionChats,
        evolutionLabels,
      ] = await Promise.all([
        supabase
          .from('Leads')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('n8n_chat_histories')
          .select('session_id, hora_data_mensagem, id, message')
          .order('hora_data_mensagem', { ascending: false, nullsFirst: false })
          .order('id', { ascending: false })
          .limit(2000),
        evolutionChatsPromise,
        evolutionLabelsPromise,
      ]);

      if (leadsError || historyError) {
        console.error('Error fetching leads or latest messages:', leadsError || historyError);
        if (mounted) {
          setSyncState('error');
          setSyncMessage('Nao foi possivel atualizar os contatos. Verifique a sessao do Supabase.');
        }
      } else {
        const latestMessageByLeadId = (historyData || []).reduce((acc, item) => {
          const normalizedSessionId = normalizeLeadId(item.session_id);

          if (!normalizedSessionId) {
            return acc;
          }

          const existingEntry = acc.get(normalizedSessionId);
          const candidateTimestamp = item.hora_data_mensagem;
          const candidateTime = candidateTimestamp ? new Date(candidateTimestamp).getTime() : 0;
          const existingTime = existingEntry?.timestamp ? new Date(existingEntry.timestamp).getTime() : 0;

          if (!existingEntry || candidateTime >= existingTime) {
            acc.set(normalizedSessionId, {
              timestamp: candidateTimestamp,
              preview: getPreviewFromHistoryMessage(item.message),
            });
          }

          return acc;
        }, new Map<string, { timestamp: string | null; preview: string | null }>());

        const evolutionChatByLeadId = evolutionChats.reduce((acc, chat) => {
          const normalizedLeadId = normalizeLeadId(chat.remoteJid);

          if (!normalizedLeadId) {
            return acc;
          }

          const existing = acc.get(normalizedLeadId);
          const candidateTimestamp = chat.updatedAt ? new Date(chat.updatedAt).getTime() : 0;
          const existingTimestamp = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;

          if (!existing || candidateTimestamp >= existingTimestamp) {
            acc.set(normalizedLeadId, chat);
          }

          return acc;
        }, new Map<string, (typeof evolutionChats)[number]>());

        const leadsWithLastMessage = (leadsData || []).map((lead) => {
          const normalizedLeadId = normalizeLeadId(lead.lead_id);
          const evolutionChat = evolutionChatByLeadId.get(normalizedLeadId);
          return {
            ...lead,
            lead_id: normalizedLeadId,
            lead_nome: lead.lead_nome || evolutionChat?.pushName || 'Sem nome',
            labels: Array.isArray(lead.labels) && lead.labels.length > 0 ? lead.labels : evolutionChat?.labels || [],
            last_message_at: latestMessageByLeadId.get(normalizedLeadId)?.timestamp ?? evolutionChat?.updatedAt ?? null,
            last_message_preview: latestMessageByLeadId.get(normalizedLeadId)?.preview ?? null,
            remote_jid: evolutionChat?.remoteJid || lead.lead_id,
            avatar_url: evolutionChat?.profilePicUrl || null,
          };
        });

        const existingLeadIds = new Set(leadsWithLastMessage.map((lead) => lead.lead_id));
        const shouldUseEvolutionOnlyFallback = (leadsData || []).length === 0;
        const leadsFromEvolutionOnly: Lead[] = shouldUseEvolutionOnlyFallback
          ? evolutionChats
              .filter((chat) => !existingLeadIds.has(normalizeLeadId(chat.remoteJid)))
              .map((chat, index) => ({
                id: -1 - index,
                lead_id: normalizeLeadId(chat.remoteJid),
                lead_nome: chat.pushName || 'Sem nome',
                created_at: chat.updatedAt || new Date(0).toISOString(),
                labels: chat.labels || [],
                last_message_at: chat.updatedAt || null,
                last_message_preview: null,
                remote_jid: chat.remoteJid,
                avatar_url: chat.profilePicUrl || null,
              }))
          : [];

        if (mounted) {
          setLeads([...leadsWithLastMessage, ...leadsFromEvolutionOnly]);
          setAvailableLabels((evolutionLabels || []).filter((label) => label?.id));
          setLastUpdatedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
          setSyncState((current) => (current === 'error' ? 'polling' : current));
          setSyncMessage('Lista sincronizada com Supabase e fallback da Evolution.');
        }
      }
      if (mounted) {
        setLoading(false);
      }
    }

    fetchLeads();

    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Leads' },
        () => {
          fetchLeads();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'n8n_chat_histories' },
        () => {
          fetchLeads();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setSyncState('realtime');
          setSyncMessage('Contatos e conversas atualizando em tempo real.');
        } else if (!isCleaningUp && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')) {
          console.error('Lead realtime channel failed. Falling back to polling.');
          setSyncState('polling');
          setSyncMessage('Realtime indisponivel. Atualizando contatos por verificacao periodica.');
        }
      });

    const intervalId = window.setInterval(fetchLeads, 30000);

    const handleWindowRefresh = () => {
      if (document.visibilityState === 'visible') {
        fetchLeads();
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
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const container = filtersScrollRef.current;
      const dragState = dragStateRef.current;

      if (!container || !dragState.isDragging) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;
      container.scrollLeft = dragState.startScrollLeft - deltaX;
    };

    const stopDragging = () => {
      dragStateRef.current.isDragging = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
    };
  }, []);

  const dedupedLeads = Array.from(
    Array.from(
      leads.reduce((acc, lead) => {
      const normalizedLeadId = normalizeLeadId(lead.lead_id);
      const mergeKeys = getLeadMergeKeys(lead);

      if (!normalizedLeadId) {
        return acc;
      }

      const normalizedLead = { ...lead, lead_id: normalizedLeadId };
      const existingLead = mergeKeys
        .map((key) => acc.get(key))
        .find((candidateLead): candidateLead is Lead => Boolean(candidateLead));

      const preferredLead = existingLead
        ? mergeLeadData(existingLead, normalizedLead)
        : normalizedLead;

      if (existingLead) {
        getLeadMergeKeys(existingLead).forEach((key) => {
          acc.set(key, preferredLead);
        });
      }

      mergeKeys.forEach((key) => {
        acc.set(key, preferredLead);
      });

      return acc;
    }, new Map<string, Lead>()).values()
    ).reduce((acc, lead) => {
      const uniqueKey = `${lead.id}:${normalizeLeadId(lead.lead_id)}`;

      if (!acc.has(uniqueKey)) {
        acc.set(uniqueKey, lead);
      }

      return acc;
    }, new Map<string, Lead>()).values()
  )
    .filter((lead) => hasUsefulLeadName(lead.lead_nome) || Boolean(getLeadContactPhone(lead.lead_id, lead.remote_jid)))
    .sort((a, b) => {
    const aLastActivity = a.last_message_at ? new Date(a.last_message_at).getTime() : new Date(a.created_at).getTime();
    const bLastActivity = b.last_message_at ? new Date(b.last_message_at).getTime() : new Date(b.created_at).getTime();

    if (bLastActivity !== aLastActivity) {
      return bLastActivity - aLastActivity;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const filteredLeads = dedupedLeads.filter(lead => {
    const matchesSearch = lead.lead_nome?.toLowerCase().includes(search.toLowerCase()) ||
                         lead.lead_id?.includes(search);
    
    const labels = Array.isArray(lead.labels) ? lead.labels : [];
    const matchesLabel = selectedLabel === 'all' || 
                        labels.some((l: any) => l.id === selectedLabel);
    
    return matchesSearch && matchesLabel;
  });

  const allLabels = Array.from(
    [...availableLabels, ...dedupedLeads.flatMap((lead) => (Array.isArray(lead.labels) ? lead.labels : []))].reduce((acc, label) => {
      if (label && label.id && !acc.has(label.id)) {
        acc.set(label.id, label);
      }
      return acc;
    }, new Map<string, Label>()).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const labelCounts = dedupedLeads.reduce((acc, lead) => {
    const labels = Array.isArray(lead.labels) ? lead.labels : [];
    labels.forEach((label: any) => {
      if (label?.id) {
        acc.set(label.id, (acc.get(label.id) || 0) + 1);
      }
    });
    return acc;
  }, new Map<string, number>());

  const syncTone =
    syncState === 'realtime'
      ? 'text-emerald-300'
      : syncState === 'polling'
        ? 'text-amber-200'
        : syncState === 'error'
          ? 'text-red-300'
          : 'text-zinc-400';

  const SyncIcon =
    syncState === 'realtime' ? Radio : syncState === 'error' ? AlertTriangle : RefreshCw;

  return (
    <div className="w-[460px] h-full border-r border-[#1f1f1f] flex flex-col shrink-0 bg-[#0f0f0f]">
      <div className="border-b border-[#1f1f1f] bg-[#0f0f0f] px-4 pb-4 pt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Inbox</p>
            <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-white">Conversas</h2>
            <div className={cn("mt-2 flex items-center gap-2 text-[11px]", syncTone)}>
              <SyncIcon className={cn("h-3 w-3 shrink-0", syncState === 'polling' || syncState === 'connecting' ? 'animate-spin' : '')} />
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
            className="w-full rounded-full border border-[#1f1f1f] bg-white/5 pl-11 pr-4 py-3 text-[13px] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700 focus:border-zinc-700 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {allLabels.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Filtros</span>
              <span className="text-[11px] text-zinc-500">{filteredLeads.length} visiveis</span>
            </div>

            <div
              ref={filtersScrollRef}
              className="-mx-1 cursor-grab overflow-x-auto overflow-y-hidden px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden active:cursor-grabbing"
              onWheel={(event) => {
                const container = filtersScrollRef.current;

                if (!container) {
                  return;
                }

                if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                  container.scrollLeft += event.deltaY;
                  event.preventDefault();
                }
              }}
              onMouseDown={(event) => {
                const container = filtersScrollRef.current;

                if (!container) {
                  return;
                }

                dragStateRef.current = {
                  isDragging: true,
                  startX: event.clientX,
                  startScrollLeft: container.scrollLeft,
                };
                event.preventDefault();
              }}
            >
              <div className="flex w-max gap-2 touch-pan-x select-none">
              <button
                onClick={() => setSelectedLabel('all')}
                className={cn(
                  "group shrink-0 rounded-full border px-3 py-2 text-[12px] font-medium transition-all",
                  selectedLabel === 'all'
                    ? "border-white/15 bg-white/10 text-white"
                    : "border-white/8 bg-white/[0.03] text-zinc-300 hover:border-white/15 hover:bg-white/[0.06]"
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-white/80" />
                  Tudo
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px]",
                    selectedLabel === 'all' ? "bg-black/20 text-white" : "bg-white/5 text-zinc-400"
                  )}>
                    {dedupedLeads.length}
                  </span>
                </span>
              </button>

              {allLabels.map((label) => {
                const isActive = selectedLabel === label.id;

                return (
                  <button
                    key={label.id}
                    onClick={() => setSelectedLabel(label.id)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-2 text-[12px] font-medium transition-all",
                      !isActive && "hover:-translate-y-0.5 hover:border-white/15"
                    )}
                    style={getLabelTheme(label.color, isActive)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={getLabelDotStyle(label.color)} />
                      <span className="max-w-[140px] truncate">{label.name}</span>
                      <span className="rounded-full bg-black/15 px-1.5 py-0.5 text-[10px] text-current/90">
                        {labelCounts.get(label.id) || 0}
                      </span>
                    </span>
                  </button>
                );
              })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-[#0a0a0a] px-2 py-3 space-y-1.5">
        {loading ? (
          <div className="p-4 text-center text-xs text-zinc-500">Carregando contatos...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-500">Nenhum contato encontrado</div>
        ) : (
          filteredLeads.map((lead) => (
            <button
              key={lead.id}
              onClick={() => onSelectLead(lead)}
              className={cn(
                "w-full flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all duration-150 text-left",
                normalizeLeadId(selectedLeadId) === lead.lead_id
                  ? "border-white/15 bg-white/10 shadow-[0_14px_34px_rgba(0,0,0,0.28)]"
                  : "border-transparent bg-transparent hover:border-white/5 hover:bg-white/[0.03]"
              )}
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/8 bg-gradient-to-br from-[#2a3942] to-[#1a252c] text-zinc-300">
                {lead.avatar_url ? (
                  <img
                    src={lead.avatar_url}
                    alt={getLeadDisplayName(lead.lead_nome, lead.lead_id, lead.remote_jid)}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserIcon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "truncate text-[15px] leading-5",
                      normalizeLeadId(selectedLeadId) === lead.lead_id ? "font-semibold text-white" : "font-medium text-zinc-100"
                    )}>
                      {getLeadDisplayName(lead.lead_nome, lead.lead_id, lead.remote_jid)}
                    </p>
                    <p className="mt-1 truncate text-[13px] leading-5 text-zinc-400">
                      {getLeadFallbackText(lead)}
                    </p>

                    {Array.isArray(lead.labels) && lead.labels.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {lead.labels.slice(0, 2).map((label: any) => (
                          <span
                            key={label.id}
                            className="inline-flex max-w-[140px] items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium"
                            style={getLabelTheme(label.color, false)}
                            title={label.name}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={getLabelDotStyle(label.color)} />
                            <span className="truncate">{label.name}</span>
                          </span>
                        ))}

                        {lead.labels.length > 2 && (
                          <span className="inline-flex items-center rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-zinc-400">
                            +{lead.labels.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                    <span className={cn(
                      "text-[11px] font-medium",
                      normalizeLeadId(selectedLeadId) === lead.lead_id ? "text-white" : "text-zinc-500"
                    )}>
                      {formatLeadTime(lead.last_message_at)}
                    </span>
                    <span className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      normalizeLeadId(selectedLeadId) === lead.lead_id
                        ? "bg-white/80"
                        : "bg-white/6"
                    )} />
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
