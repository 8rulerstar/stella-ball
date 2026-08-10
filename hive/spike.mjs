/** Runs only against a real, configured server-side Hive adapter. Never mocks success. */
const baseUrl = (process.env.HIVE_PROXY_URL ?? '').replace(/\/$/, '');
if (!baseUrl) throw new Error('HIVE_PROXY_URL is required. See HIVE_SETUP.md.');

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json', ...(process.env.HIVE_SPIKE_TOKEN ? { authorization: `Bearer ${process.env.HIVE_SPIKE_TOKEN}` } : {}) },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${body.message ?? response.statusText}`);
  return body;
};

const nonce = `spike-${Date.now()}`;
const probe = { key: 'prismBreakersSpike', value: nonce };
const writeRead = await request('/spike/write-read', { method: 'POST', body: JSON.stringify(probe) });
if (writeRead?.value !== nonce) throw new Error('Write/read round trip returned an unexpected value.');
const score = await request('/runs', { method: 'POST', body: JSON.stringify({ stage: 'S-01', party: ['gaon', 'biyeon', 'lumi'], shotsUsed: 4, totalDamage: 240, elapsedMs: 60000, source: 'spike' }) });
const leaderboard = await request('/leaderboard?metric=totalDamage');
console.log(JSON.stringify({ writeRead, score, leaderboard }, null, 2));
