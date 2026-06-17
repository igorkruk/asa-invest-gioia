export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const TOKEN = process.env.RD_TOKEN;
  const PIPELINE_ID = process.env.RD_PIPELINE_ID;
  const BASE = 'https://crm.rdstation.com/api/v1';

  try {
    const [allRes, wonRes, lostRes] = await Promise.all([
      fetch(`${BASE}/deals?token=${TOKEN}&deal_pipeline_id=${PIPELINE_ID}&limit=200`),
      fetch(`${BASE}/deals?token=${TOKEN}&deal_pipeline_id=${PIPELINE_ID}&limit=1&win=true`),
      fetch(`${BASE}/deals?token=${TOKEN}&deal_pipeline_id=${PIPELINE_ID}&limit=1&win=false`),
    ]);

    const [allData, wonData, lostData] = await Promise.all([
      allRes.json(), wonRes.json(), lostRes.json(),
    ]);

    const wonTotal = wonData.total || 0;
    const lostTotal = lostData.total || 0;
    const grandTotal = allData.total || 0;
    const openTotal = Math.max(grandTotal - wonTotal - lostTotal, 0);

    const openSample = (allData.deals || [])
      .filter(d => d.win === null || d.win === undefined)
      .map(d => ({
        id: d._id,
        name: d.name,
        stage: d.deal_stage?.name || 'Sem etapa',
        user: d.user?.name || '—',
      }));

    res.status(200).json({
      open_total: openTotal,
      won_total: wonTotal,
      lost_total: lostTotal,
      grand_total: grandTotal,
      open_sample: openSample,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
