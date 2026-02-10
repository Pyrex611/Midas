const api = '/api';

async function fetchDash() {
  const r = await fetch(`${api}/dashboard`);
  const data = await r.json();
  render(data);
}

function render(data) {
  const s = data.stats;
  document.getElementById('stats').innerHTML = `
    <h2>Performance Snapshot</h2>
    <div class="kpis">
      <div class="kpi"><span>Total Leads</span><b>${s.total_leads}</b></div>
      <div class="kpi"><span>Contacted</span><b>${s.contacted}</b></div>
      <div class="kpi"><span>Replied</span><b>${s.replied}</b></div>
      <div class="kpi"><span>Conversion %</span><b>${s.conversion_rate}</b></div>
      <div class="kpi"><span>Open Alerts</span><b>${s.open_alerts}</b></div>
      <div class="kpi"><span>Draft Bank</span><b>${s.draft_count}</b></div>
    </div>
    <p class="small">Sentiment: ${JSON.stringify(data.sentiment)}</p>
  `;

  document.getElementById('alerts').innerHTML = data.alerts.map(a => `<li>[${a.level}] ${a.message}</li>`).join('') || '<li>All clear.</li>';
  document.getElementById('leads').innerHTML = data.leads.map(l => `<li>${l.name} (${l.email}) — ${l.status}</li>`).join('') || '<li>No leads yet.</li>';
  document.getElementById('templates').innerHTML = data.templates.map(t => `<li>${t.name} (${(t.score * 100).toFixed(0)}%) used ${t.usage_count}x</li>`).join('') || '<li>No templates yet.</li>';
}

async function importLeads() {
  const file = document.getElementById('leadFile').files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch(`${api}/leads/import`, { method: 'POST', body: fd });
  document.getElementById('importResult').textContent = JSON.stringify(await r.json());
  fetchDash();
}

function config() {
  return {
    objective: document.getElementById('objective').value || 'Book calls',
    tone: 'professional',
    cta: '15-minute call',
    user_name: 'Midas User',
    signature: 'Best regards',
    auto_reply_enabled: false,
  }
}

async function doCampaign(path) {
  const r = await fetch(`${api}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config())
  });
  document.getElementById('campaignResult').textContent = JSON.stringify(await r.json());
  fetchDash();
}

document.getElementById('importBtn').onclick = importLeads;
document.getElementById('bootstrapBtn').onclick = () => doCampaign('/campaign/templates/bootstrap');
document.getElementById('outreachBtn').onclick = () => doCampaign('/campaign/outreach/run');
document.getElementById('followupBtn').onclick = () => doCampaign('/campaign/followups/run');

fetchDash();
