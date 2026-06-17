import crypto from 'crypto';
export const config = { runtime: 'nodejs' };

function sign(body, secret) { return crypto.createHmac('sha256', secret).update(body).digest('base64url'); }
function makeToken(secret) {
  const body = Buffer.from(JSON.stringify({ exp: Date.now() + 7 * 864e5 })).toString('base64url'); // 7 dias
  return body + '.' + sign(body, secret);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método não permitido' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const user = body && body.user, pass = body && body.pass;
  const SECRET = process.env.AUTH_SECRET;
  if (!SECRET) { res.status(500).json({ error: 'AUTH_SECRET não configurado na Vercel' }); return; }

  if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) {
    res.status(200).json({ token: makeToken(SECRET) });
  } else {
    res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }
}
