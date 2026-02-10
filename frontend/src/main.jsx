import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import './styles.css'

const api = (path, options = {}) => fetch(`/api${path}`, options).then((r) => r.json())

function Card({ title, value, subtitle }) {
  return (
    <div className="card">
      <h4>{title}</h4>
      <h2>{value}</h2>
      <p>{subtitle}</p>
    </div>
  )
}

function App() {
  const [stats, setStats] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [templates, setTemplates] = useState([])
  const [form, setForm] = useState({ objective: 'book sales calls', niche: 'B2B SaaS', count: 6, tone: 'professional' })

  const load = async () => {
    const [s, a, t] = await Promise.all([api('/stats'), api('/alerts'), api('/templates')])
    setStats(s)
    setAlerts(a)
    setTemplates(t)
  }

  useEffect(() => { load() }, [])

  const chartData = useMemo(() => {
    if (!stats) return []
    return [
      { name: 'Leads', value: stats.leads_total },
      { name: 'Contacted', value: stats.leads_contacted },
      { name: 'Replied', value: stats.leads_replied },
      { name: 'Converted', value: stats.leads_converted }
    ]
  }, [stats])

  const generate = async () => {
    await api('/templates/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    await load()
  }

  return (
    <main className="app">
      <header>
        <div>
          <h1>Midas</h1>
          <p>Outreach intelligence and lead conversion command center.</p>
        </div>
        <button className="action" onClick={() => api('/campaign/send-outreach', { method: 'POST' }).then(load)}>Run Outreach Batch</button>
      </header>

      {stats && <section className="grid cards">
        <Card title="Total Leads" value={stats.leads_total} subtitle="All imported contacts" />
        <Card title="Response Rate" value={`${stats.response_rate}%`} subtitle="Replies ÷ Contacted" />
        <Card title="Opt-Out Rate" value={`${stats.opt_out_rate}%`} subtitle="Compliance health" />
        <Card title="Templates" value={stats.templates_count} subtitle="Ranked draft bank" />
      </section>}

      <section className="grid two">
        <div className="panel">
          <h3>Pipeline Performance</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#c9a227" radius={[8,8,0,0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <h3>Generate Outreach Template Pack</h3>
          <label>Objective<input value={form.objective} onChange={(e)=>setForm({...form, objective: e.target.value})} /></label>
          <label>Niche<input value={form.niche} onChange={(e)=>setForm({...form, niche: e.target.value})} /></label>
          <label>Tone<input value={form.tone} onChange={(e)=>setForm({...form, tone: e.target.value})} /></label>
          <label>Count<input type="number" value={form.count} onChange={(e)=>setForm({...form, count: Number(e.target.value)})} /></label>
          <button className="action" onClick={generate}>Generate & Optimize</button>
        </div>
      </section>

      <section className="grid two">
        <div className="panel">
          <h3>Live Alerts</h3>
          <ul className="list">
            {alerts.map((a) => <li key={a.id}><strong>{a.severity.toUpperCase()}</strong> · {a.message}</li>)}
            {!alerts.length && <li>No active alerts</li>}
          </ul>
        </div>
        <div className="panel">
          <h3>Top Templates</h3>
          <ul className="list">
            {templates.slice(0, 5).map((t) => <li key={t.id}><strong>{t.name}</strong><small>Score: {t.score}</small></li>)}
          </ul>
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
