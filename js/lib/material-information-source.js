// Stock Detail 消息面 panel: a symbol's most recent MOPS 重大訊息 rows
// (material_information, anon-readable - 028_material_information.sql).
// Display-only; nothing here feeds any score.

export const MATERIAL_INFORMATION_HISTORY_START = '2026-09-25';

export function normalizeMaterialInformationRow(row) {
  return {
    announcementDate: row?.announcement_date ?? '',
    announcementTime: String(row?.announcement_time ?? '').slice(0, 5),
    subject: String(row?.subject ?? '').replace(/\s*\n\s*/g, ' ').trim(),
    clause: row?.clause ?? null,
    eventDate: row?.event_date ?? null
  };
}

export async function fetchRecentMaterialInformation({ url, anonKey, symbol, limit = 10, fetchImpl = fetch }) {
  if (!url) throw new Error('Supabase URL is required');
  if (!anonKey) throw new Error('Supabase anon key is required');
  if (!symbol) throw new Error('symbol is required');

  const params = new URLSearchParams({
    symbol: `eq.${String(symbol).trim().toUpperCase()}`,
    select: 'announcement_date,announcement_time,subject,clause,event_date',
    order: 'announcement_date.desc,announcement_time.desc',
    limit: String(limit)
  });
  const response = await fetchImpl(`${String(url).replace(/\/$/, '')}/rest/v1/material_information?${params.toString()}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`material_information query failed (${response.status}): ${body}`);
  }
  return (await response.json()).map(normalizeMaterialInformationRow);
}
