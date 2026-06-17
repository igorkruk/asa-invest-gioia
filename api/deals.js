export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const TOKEN = process.env.RD_TOKEN;
  const PIPELINE_ID = process.env.RD_PIPELINE_ID;
  const BASE = 'https://crm.rdstation.com/api/v1';

  try {
    let page = 1;
    let hasMore = true;
    const all = [];

    // Puxa todas as páginas (trava de segurança em 30 páginas)
    while (hasMore && page <= 30) {
      const url = `${BASE}/deals?token=${TOKEN}&deal_pipeline_id=${PIPELINE_ID}&limit=200&page=${page}`;
      const r = await fetch(url);
      const data = await r.json();
      const deals = data.deals || [];
      all.push(...deals);
      hasMore = data.has_more === true && deals.length > 0;
      page++;
    }

    // Mantém só os campos que vamos usar nos gráficos
    const trimmed = all.map(d => ({
      id: d._id,
      name: d.name,
      amount: Number(d.amount_total || d.amount_unique || 0),
      stage: d.deal_stage?.name || 'Sem etapa',
      user: d.user?.name || '—',
      source: d.deal_source?.name || 'Sem origem',
      win: d.win,                                  // true / false / null
      lost_reason: d.deal_lost_reason?.name || null,
      created_at: d.created_at || null,
      last_activity_at: d.last_activity_at || null,
    }));

    // Agregados de compatibilidade (pro dashboard atual continuar funcionando)
    const won  = trimmed.filter(d => d.win === true).length;
    const lost = trimmed.filter(d => d.win === false).length;
    const open = trimmed.filter(d => d.win === null || d.win === undefined).length;

    res.status(200).json({
      total: trimmed.length,
      deals: trimmed,
      open_total: open,
      won_total: won,
      lost_total: lost,
      grand_total: trimmed.length,
      open_sample: trimmed
        .filter(d => d.win === null || d.win === undefined)
        .slice(0, 15)
        .map(d => ({ name: d.name, stage: d.stage, user: d.user })),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
