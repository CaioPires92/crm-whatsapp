export function flattenHospedinSettings(hospedin) {
  const settings = hospedin || {};
  const defaultApiBaseUrl = 'https://pms.hospedin.com/api/v2';
  const defaultFallbackMessage = 'No momento nao consegui confirmar a disponibilidade em tempo real. Posso seguir com a cotacao e a equipe confirma manualmente.';
  const enabled = settings.enabled === true;
  const apiBaseUrl = String(settings.api_base_url || defaultApiBaseUrl).trim();
  const accountSlug = String(settings.account_slug || settings.account_id || '').trim() || null;
  const timeoutMs = Number.isFinite(Number(settings.timeout_ms)) && Number(settings.timeout_ms) >= 1000
    ? Number(settings.timeout_ms)
    : 10000;
  const availabilityThreshold = Number.isFinite(Number(settings.availability_threshold)) && Number(settings.availability_threshold) >= 0
    ? Number(settings.availability_threshold)
    : 3;
  const cacheTtlSeconds = Number.isFinite(Number(settings.cache_ttl_seconds)) && Number(settings.cache_ttl_seconds) >= 60
    ? Number(settings.cache_ttl_seconds)
    : 900;
  const fallbackMessage = String(settings.fallback_message || defaultFallbackMessage).trim();
  const hasMeaningfulChanges =
    enabled ||
    Boolean(accountSlug) ||
    apiBaseUrl !== defaultApiBaseUrl ||
    timeoutMs !== 10000 ||
    availabilityThreshold !== 3 ||
    cacheTtlSeconds !== 900 ||
    fallbackMessage !== defaultFallbackMessage;

  if (!hasMeaningfulChanges) {
    return null;
  }

  return {
    id: 1,
    enabled,
    api_base_url: apiBaseUrl,
    account_id: accountSlug,
    timeout_ms: timeoutMs,
    availability_threshold: availabilityThreshold,
    cache_ttl_seconds: cacheTtlSeconds,
    fallback_message: fallbackMessage,
  };
}

export function flattenHospedinRoomMappings(roomMappings) {
  const rows = [];

  for (const [roomType, value] of Object.entries(roomMappings || {})) {
    const normalizedRoomType = String(roomType || '').trim();
    if (!normalizedRoomType) continue;

    const row = typeof value === 'string'
      ? { place_type_id: value }
      : (value || {});
    const placeTypeId = String(row.place_type_id || '').trim() || null;
    if (!placeTypeId) continue;
    const placeTypeTitle = String(row.place_type_title || '').trim() || null;
    const active = row.active !== false;
    const notes = String(row.notes || '').trim();

    rows.push({
      room_type: normalizedRoomType,
      place_type_id: placeTypeId,
      place_type_title: placeTypeTitle,
      active,
      notes,
    });
  }

  return rows;
}
