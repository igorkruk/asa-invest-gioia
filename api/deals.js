export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const TOKEN = process.env.RD_TOKEN;
  const PIPELINE_ID = process.env.RD_PIPELINE_ID;
  const BASE = 'https://crm.rdstation.com/api/v1';

  // Lê um campo customizado pelo label (case-insensitive), tolerante a formatos
  const cf = (deal, label) => {
    const arr = deal.deal_custom_fields || [];
    const want = String(label).toLowerCase();
    for (const f of arr) {
      const l = (f.custom_field && f.custom_field.label) || f.label || f.name || '';
      if (String(l).toLowerCase() === want) {
        const v = f.value;
        return Array.isArray(v) ? v.join(', ') : (v ?? null);
      }
    }
    return null;
  };

  try {
    // 1) Ordem real das etapas
    let stageOrder = [];
    try {
      const pr = await fetch(`${BASE}/deal_pipelines?token=${TOKEN}`);
      const pdata = await pr.json();
      const arr = Array.isArray(pdata) ? pdata : (pdata.deal_pipelines || pdata.deals_pipelines || []);
      const pipe = arr.find(p => p._id === PIPELINE_ID || p.id === PIPELINE_ID);
      const st = pipe && (pipe.deal_stages || pipe.deals_stages);
      if (Array.isArray(st)) stageOrder = st.slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(s=>s.name);
    } catch (_) {}

    // 2) Todos os negócios
    let page = 1, hasMore = true; const all = [];
    while (hasMore && page <= 30) {
      const r = await fetch(`${BASE}/deals?token=${TOKEN}&deal_pipeline_id=${PIPELINE_ID}&limit=200&page=${page}`);
      const data = await r.json();
      const deals = data.deals || [];
      all.push(...deals);
      hasMore = data.has_more === true && deals.length > 0;
      page++;
    }

    const trimmed = all.map(d => ({
      id: d._id,
      name: d.name,
      amount: Number(d.amount_total || d.amount_unique || 0),
      stage: d.deal_stage?.name || 'Sem etapa',
      user: d.user?.name || '—',
      source: d.deal_source?.name || 'Sem origem',   // Fonte / Canal
      campaign: cf(d, 'campaign'),                    // Campanha
      adset: cf(d, 'adset'),                          // Conjunto
      ad: cf(d, 'ad'),                                // Anúncio
      win: d.win,
      lost_reason: d.deal_lost_reason?.name || null,
      created_at: d.created_at || null,
      closed_at: d.closed_at || null,
      last_activity_at: d.last_activity_at || null,
    }));

    res.status(200).json({ total: trimmed.length, stage_order: stageOrder, deals: trimmed, updated_at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
