import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { fetchStockPrice } from '../utils/finnhub'

export function usePortfolio(user) {
  const [holdings, setHoldings] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [config, setConfig] = useState({
    finnhub_key: '', anthropic_key: '',
    max_sector_pct: 30, max_pos_pct: 20, min_sectors: 3, momentum_warn_pct: -10
  })
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [msg, setMsg] = useState(null)

  // Load data from Supabase
  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const [hRes, sRes, cRes] = await Promise.all([
        supabase.from('holdings').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('snapshots').select('*').eq('user_id', user.id).order('date'),
        supabase.from('configs').select('*').eq('user_id', user.id).single()
      ])
      if (hRes.data) setHoldings(hRes.data)
      if (sRes.data) setSnapshots(sRes.data)
      if (cRes.data) setConfig(cRes.data)
      else {
        // Create default config for new user
        await supabase.from('configs').insert({ user_id: user.id })
      }
      setLoading(false)
    }
    load()
  }, [user])

  // Save config
  const saveConfig = useCallback(async (newCfg) => {
    setConfig(newCfg)
    await supabase.from('configs').upsert({ ...newCfg, user_id: user.id, updated_at: new Date().toISOString() })
  }, [user])

  // Add holding
  const addHolding = useCallback(async (h) => {
    const row = { ...h, user_id: user.id }
    const { data } = await supabase.from('holdings').insert(row).select().single()
    if (data) setHoldings(prev => [...prev, data])
  }, [user])

  // Delete holding
  const deleteHolding = useCallback(async (id) => {
    await supabase.from('holdings').delete().eq('id', id)
    setHoldings(prev => prev.filter(h => h.id !== id))
  }, [])

  // Edit holding
  const editHolding = useCallback(async (id, changes) => {
    await supabase.from('holdings').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id)
    setHoldings(prev => prev.map(h => h.id === id ? { ...h, ...changes } : h))
  }, [])

  // Fetch all prices
  const fetchAllPrices = useCallback(async () => {
    if (!config.finnhub_key || !holdings.length) {
      setMsg({ t: 'w', m: 'Configurá tu Finnhub API Key en ⚙️ Config' })
      setTimeout(() => setMsg(null), 4000)
      return
    }
    setFetching(true)
    let ok = 0, fail = 0
    const updates = []
    for (let i = 0; i < holdings.length; i++) {
      const x = holdings[i]
      const q = await fetchStockPrice(x.ticker, x.type, x.cedear_ratio, x.cedear_us, config.finnhub_key)
      if (q) {
        updates.push({ id: x.id, current_price: q.price, day_change: q.dp || 0 })
        ok++
      } else { fail++ }
      if (i < holdings.length - 1) await new Promise(r => setTimeout(r, 200))
    }

    // Batch update Supabase
    for (const u of updates) {
      await supabase.from('holdings').update({ current_price: u.current_price, day_change: u.day_change }).eq('id', u.id)
    }

    // Update local state
    setHoldings(prev => prev.map(h => {
      const u = updates.find(u => u.id === h.id)
      return u ? { ...h, current_price: u.current_price, day_change: u.day_change } : h
    }))

    setLastUpdate(new Date().toLocaleTimeString())
    setFetching(false)
    setMsg({ t: 'g', m: ok + ' OK' + (fail > 0 ? ', ' + fail + ' fail' : '') })
    setTimeout(() => setMsg(null), 3000)

    // Auto-snapshot
    const td = new Date().toISOString().split('T')[0]
    const updated = holdings.map(h => {
      const u = updates.find(u => u.id === h.id)
      return u ? { ...h, ...u } : h
    })
    let tV = 0, tP = 0
    updated.forEach(x => {
      const pa = x.current_price || null
      tV += pa ? x.shares * pa : x.shares * x.avg_cost
      tP += pa && x.type !== 'cash' ? (pa - x.avg_cost) * x.shares : 0
    })
    const cap = tV - tP
    const rend = cap > 0 ? (tP / cap) * 100 : null
    if (rend != null) {
      await supabase.from('snapshots').upsert({ user_id: user.id, date: td, rend_pct: rend }, { onConflict: 'user_id,date' })
      setSnapshots(prev => {
        const filtered = prev.filter(s => s.date !== td)
        return [...filtered, { date: td, rend_pct: rend }]
      })
    }
  }, [holdings, config.finnhub_key, user])

  return {
    holdings, snapshots, config, loading, fetching, lastUpdate, msg,
    addHolding, deleteHolding, editHolding, fetchAllPrices, saveConfig, setMsg
  }
}
