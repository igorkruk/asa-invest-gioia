export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const TOKEN = process.env.RD_TOKEN;
  const PIPELINE_ID = process.env.RD_PIPELINE_ID;
  const BASE = 'https://crm.rdstation.com/api/v1';

  const cf = (deal, label) => {
    const arr = deal.deal_custom_fields || [];
    const want = String(label).toLowerCase();
    for (const f of arr) {
      const l = (f.custom_field && f.custom_field.label) || f.label || f.name || '';
      if (String(l).toLowerCase() === want) { const v = f.value; return Array.isArray(v) ? v.join(', ') : (v ?? null); }
    }
    return null;
  };

  try {
    // 1) Ordem das etapas
    let stageOrder = [];
    try {
      const pr = await fetch(`${BASE}/deal_pipelines?token=${TOKEN}`);
      const pdata = await pr.json();
      const arr = Array.isArray(pdata) ? pdata : (pdata.deal_pipelines || pdata.deals_pipelines || []);
      const pipe = arr.find(p => p._id === PIPELINE_ID || p.id === PIPELINE_ID);
      const st = pipe && (pipe.deal_stages || pipe.deals_stages);
      if (Array.isArray(st)) stageOrder = st.slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(s=>s.name);
    } catch (_) {}

    // 2) Negócios (paginado) + mapa id->corretor
    let page = 1, hasMore = true; const all = [];
    while (hasMore && page <= 30) {
      const r = await fetch(`${BASE}/deals?token=${TOKEN}&deal_pipeline_id=${PIPELINE_ID}&limit=200&page=${page}`);
      const data = await r.json();
      const deals = data.deals || [];
      all.push(...deals);
      hasMore = data.has_more === true && deals.length > 0;
      page++;
    }
    const dealUser = {};
    all.forEach(d => { dealUser[d._id] = d.user?.name || '—'; });

    const trimmed = all.map(d => ({
      id: d._id, name: d.name,
      amount: Number(d.amount_total || d.amount_unique || 0),
      stage: d.deal_stage?.name || 'Sem etapa',
      user: d.user?.name || '—',
      source: d.deal_source?.name || 'Sem origem',
      campaign: cf(d, 'campaign'), adset: cf(d, 'adset'), ad: cf(d, 'ad'),
      win: d.win, lost_reason: d.deal_lost_reason?.name || null,
      created_at: d.created_at || null, closed_at: d.closed_at || null, last_activity_at: d.last_activity_at || null,
    }));

    // 3) Tarefas (não filtra por funil na API -> filtra pelo deal_id dos nossos negócios)
    const tasks = [];
    let tp = 1, tmore = true;
    while (tmore && tp <= 50) {
      const r = await fetch(`${BASE}/tasks?token=${TOKEN}&limit=200&page=${tp}`);
      const data = await r.json();
      const arr = Array.isArray(data) ? data : (data.tasks || []);
      arr.forEach(t => {
        if (dealUser[t.deal_id] !== undefined) {
          tasks.push({ type: t.type || 'task', done: t.done === true, done_date: t.done_date || null, user: dealUser[t.deal_id] || '—' });
        }
      });
      tmore = data.has_more === true && arr.length > 0;
      tp++;
    }

    res.status(200).json({ total: trimmed.length, stage_order: stageOrder, deals: trimmed, tasks, updated_at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
