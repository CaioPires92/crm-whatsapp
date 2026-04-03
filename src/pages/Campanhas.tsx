import { useEffect, useMemo, useState } from 'react';
import {
  CopyCheck,
  Megaphone,
  PhoneOff,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  type Campaign,
  type CampaignHistoryRow,
  type CampaignRecipient,
  computeCampaignRecipientMetrics,
  inferFailureStatus,
  personalizeCampaignMessage,
  sendCampaignText,
} from '../lib/campaigns';
import { getLeadDisplayName, isLikelyPhoneNumber, normalizeLeadId } from '../lib/evolution';

interface Label {
  id: string;
  name: string;
  color: string;
}

interface LeadRecord {
  id: number;
  lead_nome: string | null;
  lead_id: string;
  created_at: string;
  labels?: Label[] | null;
}

interface AudienceLead extends LeadRecord {
  normalizedPhone: string | null;
}

function getLabelHue(value: string | null | undefined) {
  const parsed = Number.parseInt(value || '0', 10);
  return Number.isNaN(parsed) ? 150 : parsed * 40;
}

function getLabelStyle(color: string | null | undefined, active = false) {
  const hue = getLabelHue(color);

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

function getNormalizedPhone(value: string | null | undefined) {
  const normalized = normalizeLeadId(value).replace(/\D/g, '');
  return isLikelyPhoneNumber(normalized) ? normalized : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isCampaignSetupMissing(error: unknown) {
  const message = String(error || '').toLowerCase();
  return message.includes('campaigns') || message.includes('campaign_recipients') || message.includes('relation');
}

export default function Campanhas() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('Oi, {{nome}}! Temos uma novidade especial para voce.');
  const [campaignName, setCampaignName] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [currentCampaign, setCurrentCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [refreshingMetrics, setRefreshingMetrics] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchLeads() {
      setLoading(true);

      const { data, error } = await supabase
        .from('Leads')
        .select('id, lead_nome, lead_id, created_at, labels')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching campaign leads:', error);
        if (mounted) {
          setLeads([]);
        }
      } else if (mounted) {
        setLeads((data || []) as LeadRecord[]);
      }

      if (mounted) {
        setLoading(false);
      }
    }

    fetchLeads();

    return () => {
      mounted = false;
    };
  }, []);

  const allLabels = useMemo(() => {
    return Array.from(
      leads
        .flatMap((lead) => (Array.isArray(lead.labels) ? lead.labels : []))
        .reduce((acc, label) => {
          if (label?.id && !acc.has(label.id)) {
            acc.set(label.id, label);
          }

          return acc;
        }, new Map<string, Label>())
        .values()
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [leads]);

  const labelCounts = useMemo(() => {
    return leads.reduce((acc, lead) => {
      const labels = Array.isArray(lead.labels) ? lead.labels : [];

      labels.forEach((label) => {
        if (label?.id) {
          acc.set(label.id, (acc.get(label.id) || 0) + 1);
        }
      });

      return acc;
    }, new Map<string, number>());
  }, [leads]);

  useEffect(() => {
    if (selectedLabels.length > 0) {
      return;
    }

    const simLabel = allLabels.find((label) => label.name.trim().toLowerCase() === 'sim');

    if (simLabel) {
      setSelectedLabels([simLabel.id]);
    }
  }, [allLabels, selectedLabels.length]);

  useEffect(() => {
    if (campaignName.trim()) {
      return;
    }

    const selectedLabelNames = allLabels
      .filter((label) => selectedLabels.includes(label.id))
      .map((label) => label.name)
      .join(', ');

    if (selectedLabelNames) {
      setCampaignName(`Campanha ${selectedLabelNames} - ${new Date().toLocaleDateString('pt-BR')}`);
    }
  }, [allLabels, campaignName, selectedLabels]);

  const campaignSnapshot = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = leads.filter((lead) => {
      const labels = Array.isArray(lead.labels) ? lead.labels : [];
      const matchesLabels =
        selectedLabels.length === 0 || selectedLabels.every((labelId) => labels.some((label) => label.id === labelId));

      const matchesSearch =
        !normalizedSearch ||
        (lead.lead_nome || '').toLowerCase().includes(normalizedSearch) ||
        normalizeLeadId(lead.lead_id).includes(normalizedSearch);

      return matchesLabels && matchesSearch;
    });

    const uniquePhones = new Set<string>();
    const audience: AudienceLead[] = [];
    let invalidPhoneCount = 0;
    let duplicatePhoneCount = 0;

    filtered.forEach((lead) => {
      const normalizedPhone = getNormalizedPhone(lead.lead_id);

      if (!normalizedPhone) {
        invalidPhoneCount += 1;
        return;
      }

      if (uniquePhones.has(normalizedPhone)) {
        duplicatePhoneCount += 1;
        return;
      }

      uniquePhones.add(normalizedPhone);
      audience.push({ ...lead, normalizedPhone });
    });

    return {
      filtered,
      audience,
      invalidPhoneCount,
      duplicatePhoneCount,
    };
  }, [leads, search, selectedLabels]);

  const sampleAudience = campaignSnapshot.audience.slice(0, 24);

  async function loadLatestCampaign() {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        setCurrentCampaign(null);
        setRecipients([]);
        return;
      }

      setCurrentCampaign(data as Campaign);

      const recipientsResponse = await supabase
        .from('campaign_recipients')
        .select('*')
        .eq('campaign_id', data.id)
        .order('id', { ascending: true });

      if (recipientsResponse.error) {
        throw recipientsResponse.error;
      }

      setRecipients((recipientsResponse.data || []) as CampaignRecipient[]);
      setSetupError(null);
    } catch (error) {
      console.error('Error loading latest campaign:', error);

      if (isCampaignSetupMissing(error)) {
        setSetupError('As tabelas de campanha ainda nao existem no Supabase. Rode o SQL em docs/setup/campaigns-schema.sql.');
      }
    }
  }

  useEffect(() => {
    loadLatestCampaign();
  }, []);

  async function refreshCampaignMetrics() {
    if (!currentCampaign) {
      return;
    }

    setRefreshingMetrics(true);

    try {
      const recipientsResponse = await supabase
        .from('campaign_recipients')
        .select('*')
        .eq('campaign_id', currentCampaign.id)
        .order('id', { ascending: true });

      if (recipientsResponse.error) {
        throw recipientsResponse.error;
      }

      const latestRecipients = (recipientsResponse.data || []) as CampaignRecipient[];

      const historyResponse = await supabase
        .from('n8n_chat_histories')
        .select('session_id, hora_data_mensagem, message')
        .gte('hora_data_mensagem', currentCampaign.created_at)
        .order('hora_data_mensagem', { ascending: true })
        .limit(10000);

      if (historyResponse.error) {
        throw historyResponse.error;
      }

      const { recipients: nextRecipients, metrics } = computeCampaignRecipientMetrics(
        latestRecipients,
        (historyResponse.data || []) as CampaignHistoryRow[]
      );

      const changedRecipients = nextRecipients.filter((recipient, index) => {
        const previous = latestRecipients[index];

        return (
          previous &&
          (previous.delivery_status !== recipient.delivery_status || previous.replied_at !== recipient.replied_at)
        );
      });

      await Promise.all(
        changedRecipients.map((recipient) =>
          supabase
            .from('campaign_recipients')
            .update({
              delivery_status: recipient.delivery_status,
              replied_at: recipient.replied_at,
            })
            .eq('id', recipient.id)
        )
      );

      const campaignStatus =
        metrics.failed > 0 || metrics.blocked > 0 ? 'completed_with_failures' : currentCampaign.status;

      const { data: updatedCampaign, error: updateCampaignError } = await supabase
        .from('campaigns')
        .update({
          sent_count: metrics.sent,
          replied_count: metrics.replied,
          ignored_count: metrics.ignored,
          blocked_count: metrics.blocked,
          failed_count: metrics.failed,
          status: campaignStatus,
        })
        .eq('id', currentCampaign.id)
        .select('*')
        .single();

      if (updateCampaignError) {
        throw updateCampaignError;
      }

      setRecipients(nextRecipients);
      setCurrentCampaign(updatedCampaign as Campaign);
      setSetupError(null);
    } catch (error) {
      console.error('Error refreshing campaign metrics:', error);
      if (isCampaignSetupMissing(error)) {
        setSetupError('As tabelas de campanha ainda nao existem no Supabase. Rode o SQL em docs/setup/campaigns-schema.sql.');
      }
    } finally {
      setRefreshingMetrics(false);
    }
  }

  async function createCampaignDraft() {
    if (!campaignName.trim() || !message.trim() || campaignSnapshot.audience.length === 0) {
      return;
    }

    setCreatingDraft(true);

    try {
      const selectedLabelRecords = allLabels.filter((label) => selectedLabels.includes(label.id));

      const { data: createdCampaign, error: createCampaignError } = await supabase
        .from('campaigns')
        .insert({
          name: campaignName.trim(),
          message_template: message.trim(),
          selected_label_ids: selectedLabelRecords.map((label) => label.id),
          selected_label_names: selectedLabelRecords.map((label) => label.name),
          base_count: campaignSnapshot.filtered.length,
          duplicate_count: campaignSnapshot.duplicatePhoneCount,
          invalid_count: campaignSnapshot.invalidPhoneCount,
          audience_count: campaignSnapshot.audience.length,
          sent_count: 0,
          replied_count: 0,
          ignored_count: 0,
          blocked_count: 0,
          failed_count: 0,
          status: 'draft',
          created_by: user?.email || null,
        })
        .select('*')
        .single();

      if (createCampaignError) {
        throw createCampaignError;
      }

      const recipientsPayload = campaignSnapshot.audience.map((lead) => ({
        campaign_id: createdCampaign.id,
        lead_record_id: lead.id,
        lead_name: lead.lead_nome,
        phone_number: lead.normalizedPhone,
        personalized_message: personalizeCampaignMessage(message.trim(), lead.lead_nome),
        delivery_status: 'pending',
      }));

      const { data: createdRecipients, error: createRecipientsError } = await supabase
        .from('campaign_recipients')
        .insert(recipientsPayload)
        .select('*');

      if (createRecipientsError) {
        throw createRecipientsError;
      }

      setCurrentCampaign(createdCampaign as Campaign);
      setRecipients((createdRecipients || []) as CampaignRecipient[]);
      setSetupError(null);
    } catch (error) {
      console.error('Error creating campaign draft:', error);
      if (isCampaignSetupMissing(error)) {
        setSetupError('As tabelas de campanha ainda nao existem no Supabase. Rode o SQL em docs/setup/campaigns-schema.sql.');
      }
    } finally {
      setCreatingDraft(false);
    }
  }

  async function startCampaignSending() {
    if (!currentCampaign || sendingCampaign) {
      return;
    }

    setSendingCampaign(true);

    try {
      const { error: campaignStartError } = await supabase
        .from('campaigns')
        .update({
          status: 'sending',
          started_at: currentCampaign.started_at || new Date().toISOString(),
        })
        .eq('id', currentCampaign.id);

      if (campaignStartError) {
        throw campaignStartError;
      }

      const pendingRecipients = recipients.filter((recipient) => recipient.delivery_status === 'pending');
      const nextRecipients = [...recipients];

      for (const recipient of pendingRecipients) {
        const personalizedMessage =
          recipient.personalized_message || personalizeCampaignMessage(currentCampaign.message_template, recipient.lead_name);

        try {
          await sendCampaignText(recipient.phone_number, personalizedMessage);

          const sentAt = new Date().toISOString();
          const { error: updateRecipientError } = await supabase
            .from('campaign_recipients')
            .update({
              delivery_status: 'sent',
              sent_at: sentAt,
              personalized_message: personalizedMessage,
              error_message: null,
            })
            .eq('id', recipient.id);

          if (updateRecipientError) {
            throw updateRecipientError;
          }

          await supabase.from('n8n_chat_histories').insert({
            session_id: `${normalizeLeadId(recipient.phone_number)}@s.whatsapp.net`,
            message: {
              type: 'ai',
              content: personalizedMessage,
            },
            hora_data_mensagem: sentAt,
          });

          const localRecipient = nextRecipients.find((item) => item.id === recipient.id);
          if (localRecipient) {
            localRecipient.delivery_status = 'sent';
            localRecipient.sent_at = sentAt;
            localRecipient.personalized_message = personalizedMessage;
            localRecipient.error_message = null;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Falha ao enviar campanha.';
          const failureStatus = inferFailureStatus(errorMessage);

          await supabase
            .from('campaign_recipients')
            .update({
              delivery_status: failureStatus,
              error_message: errorMessage,
            })
            .eq('id', recipient.id);

          const localRecipient = nextRecipients.find((item) => item.id === recipient.id);
          if (localRecipient) {
            localRecipient.delivery_status = failureStatus;
            localRecipient.error_message = errorMessage;
          }
        }

        setRecipients([...nextRecipients]);
        await sleep(900);
      }

      const hasFailures = nextRecipients.some(
        (recipient) => recipient.delivery_status === 'failed' || recipient.delivery_status === 'blocked'
      );

      const { data: finishedCampaign, error: finishCampaignError } = await supabase
        .from('campaigns')
        .update({
          status: hasFailures ? 'completed_with_failures' : 'completed',
          finished_at: new Date().toISOString(),
        })
        .eq('id', currentCampaign.id)
        .select('*')
        .single();

      if (finishCampaignError) {
        throw finishCampaignError;
      }

      setCurrentCampaign(finishedCampaign as Campaign);
      await refreshCampaignMetrics();
      setSetupError(null);
    } catch (error) {
      console.error('Error sending campaign:', error);
      if (isCampaignSetupMissing(error)) {
        setSetupError('As tabelas de campanha ainda nao existem no Supabase. Rode o SQL em docs/setup/campaigns-schema.sql.');
      }
    } finally {
      setSendingCampaign(false);
    }
  }

  const previewRows = currentCampaign ? recipients : sampleAudience;
  const currentMetrics = currentCampaign
    ? {
        base: currentCampaign.base_count,
        dedupe: currentCampaign.duplicate_count,
        invalid: currentCampaign.invalid_count,
        sent: currentCampaign.sent_count,
        replied: currentCampaign.replied_count,
        ignored: currentCampaign.ignored_count,
        blocked: currentCampaign.blocked_count,
        failed: currentCampaign.failed_count,
      }
    : null;

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0a]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <section className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_30%),#101010] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-400">
                <Megaphone className="h-3.5 w-3.5" />
                Campanhas
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Campanha com segmentacao e rastreio</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
                Monte a audiencia pela label, crie um rascunho da campanha, envie em lote pela Evolution e acompanhe as metricas iniciais de entrega e resposta.
              </p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-300/85">
                Hoje a label <span className="font-semibold text-emerald-200">SIM</span> entra marcada por padrao porque e a base mais confiavel para disparo.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Base filtrada</p>
                <p className="mt-2 text-2xl font-semibold text-white">{campaignSnapshot.filtered.length}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Na previa</p>
                <p className="mt-2 text-2xl font-semibold text-white">{campaignSnapshot.audience.length}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Sem telefone valido</p>
                <p className="mt-2 text-2xl font-semibold text-white">{campaignSnapshot.invalidPhoneCount}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Duplicados</p>
                <p className="mt-2 text-2xl font-semibold text-white">{campaignSnapshot.duplicatePhoneCount}</p>
              </div>
            </div>
          </div>
        </section>

        {setupError && (
          <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            {setupError}
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[28px] border border-white/8 bg-[#101010] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Montagem da campanha</h2>
                <p className="mt-1 text-sm text-zinc-500">Segmente a audiencia, revise a mensagem e gere um rascunho persistido.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Nome da campanha
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                  placeholder="Ex.: Campanha SIM - Abril"
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                />
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar lead por nome ou telefone"
                  className="w-full rounded-full border border-white/8 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                />
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Labels</p>
                <button
                  type="button"
                  onClick={() => setSelectedLabels([])}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/5"
                >
                  Limpar filtros
                </button>
              </div>

              <div className="mb-4 rounded-2xl border border-emerald-500/15 bg-emerald-500/8 px-4 py-3 text-sm leading-6 text-emerald-100">
                A label <span className="font-semibold">SIM</span> representa a base mais segura de contatos para campanha no fluxo atual.
              </div>

              <div className="flex flex-wrap gap-2">
                {allLabels.map((label) => {
                  const active = selectedLabels.includes(label.id);

                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => {
                        setSelectedLabels((current) =>
                          current.includes(label.id)
                            ? current.filter((item) => item !== label.id)
                            : [...current, label.id]
                        );
                      }}
                      className="rounded-full border px-3 py-2 text-xs font-medium transition-transform hover:-translate-y-0.5"
                      style={getLabelStyle(label.color, active)}
                    >
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-current/80" />
                        <span>{label.name}</span>
                        <span className="rounded-full bg-black/15 px-1.5 py-0.5 text-[10px] text-current/90">
                          {labelCounts.get(label.id) || 0}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-white">
                <CopyCheck className="h-4 w-4" />
                <h3 className="text-sm font-semibold">Mensagem da campanha</h3>
              </div>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="mt-3 min-h-36 w-full rounded-2xl border border-white/8 bg-[#0d0d0d] p-4 text-sm leading-6 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                placeholder="Escreva a mensagem da campanha..."
              />
              <p className="mt-3 text-xs leading-5 text-zinc-500">
                Variavel disponivel: <span className="font-medium text-zinc-300">{'{{nome}}'}</span>.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={createCampaignDraft}
                disabled={creatingDraft || sendingCampaign || campaignSnapshot.audience.length === 0 || !campaignName.trim() || !message.trim()}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingDraft ? 'Criando rascunho...' : 'Criar campanha'}
              </button>

              <button
                type="button"
                onClick={startCampaignSending}
                disabled={!currentCampaign || sendingCampaign || creatingDraft || currentCampaign.status !== 'draft'}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/12 px-4 py-3 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingCampaign ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {sendingCampaign ? 'Enviando...' : 'Iniciar envio'}
              </button>

              <button
                type="button"
                onClick={refreshCampaignMetrics}
                disabled={!currentCampaign || refreshingMetrics || sendingCampaign}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={refreshingMetrics ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                Atualizar metricas
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/8 bg-[#101010] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{currentCampaign ? 'Campanha atual' : 'Preview da audiencia'}</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {currentCampaign
                    ? `${currentCampaign.name} · status ${currentCampaign.status}`
                    : 'Primeiros contatos da base filtrada depois da deduplicacao por telefone.'}
                </p>
              </div>
              <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300">
                {currentCampaign ? `${recipients.length} destinatarios` : `${campaignSnapshot.audience.length} na previa`}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-zinc-300">
                  <Users className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Base</span>
                </div>
                <p className="mt-3 text-xl font-semibold text-white">{currentMetrics ? currentMetrics.base : campaignSnapshot.filtered.length}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-zinc-300">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Duplicados</span>
                </div>
                <p className="mt-3 text-xl font-semibold text-white">{currentMetrics ? currentMetrics.dedupe : campaignSnapshot.duplicatePhoneCount}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-zinc-300">
                  <PhoneOff className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Invalidos</span>
                </div>
                <p className="mt-3 text-xl font-semibold text-white">{currentMetrics ? currentMetrics.invalid : campaignSnapshot.invalidPhoneCount}</p>
              </div>
            </div>

            {currentMetrics && (
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Enviados</p>
                  <p className="mt-2 text-xl font-semibold text-white">{currentMetrics.sent}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Responderam</p>
                  <p className="mt-2 text-xl font-semibold text-white">{currentMetrics.replied}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Ignoraram</p>
                  <p className="mt-2 text-xl font-semibold text-white">{currentMetrics.ignored}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Bloqueios/Falhas</p>
                  <p className="mt-2 text-xl font-semibold text-white">{currentMetrics.blocked + currentMetrics.failed}</p>
                </div>
              </div>
            )}

            <div className="mt-5 rounded-3xl border border-white/8 bg-[#0d0d0d]">
              <div className="border-b border-white/8 px-4 py-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
                {currentCampaign ? 'Destinatarios da campanha' : 'Amostra de destinatarios'}
              </div>

              <div className="max-h-[620px] overflow-y-auto p-3">
                {loading ? (
                  <div className="p-6 text-sm text-zinc-500">Carregando leads...</div>
                ) : previewRows.length === 0 ? (
                  <div className="p-6 text-sm text-zinc-500">Nenhum destinatario disponivel.</div>
                ) : (
                  <div className="space-y-2">
                    {previewRows.map((row) => {
                      const isCampaignRow = 'delivery_status' in row;

                      return (
                        <div key={`${isCampaignRow ? 'recipient' : 'audience'}-${row.id}`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">
                                {isCampaignRow
                                  ? getLeadDisplayName(row.lead_name, row.phone_number)
                                  : getLeadDisplayName(row.lead_nome, row.normalizedPhone)}
                              </p>
                              <p className="mt-1 text-sm text-zinc-400">
                                {isCampaignRow ? row.phone_number : row.normalizedPhone}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                                {isCampaignRow ? row.delivery_status : `Lead #${row.id}`}
                              </span>
                              {isCampaignRow && row.replied_at && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-200">
                                  <UserRoundCheck className="h-3 w-3" />
                                  Respondeu
                                </span>
                              )}
                            </div>
                          </div>
                          {isCampaignRow && row.error_message && (
                            <p className="mt-3 text-xs leading-5 text-amber-200/90">{row.error_message}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
