// Sector S&P correlation proxies
const SECTOR_CORR = {
  'Tecnología': 0.92, 'Comunicaciones': 0.85, 'Consumo Discrecional': 0.80,
  'Finanzas': 0.78, 'Industria': 0.75, 'Salud': 0.65, 'Materiales': 0.60,
  'Consumo Básico': 0.55, 'Real Estate': 0.50, 'Energía': 0.45,
  'Utilities': 0.35, 'Crypto': 0.30, 'Cash': 0, 'Otro': 0.60
}

export function analyze(holdings, cfg) {
  const wv = holdings.filter(x => x.current_price)
  if (!wv.length) return { score: 0, dS: 0, cS: 0, mS: 0, corrScore: 0, recs: [] }
  const tv = wv.reduce((s, x) => s + x.shares * x.current_price, 0)
  if (tv <= 0) return { score: 0, dS: 0, cS: 0, mS: 0, corrScore: 0, recs: [] }

  // Sector weights
  const sectors = {}
  wv.forEach(x => { const s = x.type === 'cash' ? 'Cash' : (x.sector || 'Otro'); sectors[s] = (sectors[s] || 0) + x.shares * x.current_price })
  const sectorPcts = Object.fromEntries(Object.entries(sectors).map(([k, v]) => [k, (v / tv) * 100]))
  const numSectors = Object.keys(sectors).filter(s => s !== 'Cash').length

  // Position weights
  const posPcts = wv.map(x => ({ ticker: x.ticker, pct: (x.shares * x.current_price / tv) * 100 }))

  // Returns
  const returns = wv.filter(x => x.type !== 'cash' && x.avg_cost > 0).map(x => ((x.current_price / x.avg_cost) - 1) * 100)
  const avgReturn = returns.length ? returns.reduce((s, v) => s + v, 0) / returns.length : 0

  // Diversification score (max 40)
  let dS = 40
  if (numSectors < cfg.min_sectors) dS -= 15
  Object.entries(sectorPcts).forEach(([, pct]) => { if (pct > cfg.max_sector_pct) dS -= Math.min(10, (pct - cfg.max_sector_pct) / 2) })
  dS = Math.max(0, dS)

  // Concentration score (max 30)
  let cS = 30
  posPcts.forEach(p => { if (p.pct > cfg.max_pos_pct) cS -= Math.min(10, (p.pct - cfg.max_pos_pct) / 2) })
  cS = Math.max(0, cS)

  // Momentum score (max 30)
  let mS = 30
  if (avgReturn < 0) mS -= Math.min(15, Math.abs(avgReturn))
  returns.forEach(r => { if (r < cfg.momentum_warn_pct) mS -= 3 })
  mS = Math.max(0, mS)

  const score = Math.round(dS + cS + mS)

  // Correlation
  let corrScore = 0
  wv.forEach(x => {
    const w = x.shares * x.current_price / tv
    const s = x.type === 'cash' ? 'Cash' : (x.sector || 'Otro')
    corrScore += w * (SECTOR_CORR[s] || 0.6)
  })

  // Recommendations
  const recs = []
  Object.entries(sectorPcts).forEach(([s, pct]) => { if (pct > cfg.max_sector_pct && s !== 'Cash') recs.push({ t: 'warn', c: 'Sector', x: s + ' pesa ' + pct.toFixed(1) + '% (máx ' + cfg.max_sector_pct + '%)' }) })
  posPcts.forEach(p => { if (p.pct > cfg.max_pos_pct) recs.push({ t: 'warn', c: 'Concentración', x: p.ticker + ' pesa ' + p.pct.toFixed(1) + '% (máx ' + cfg.max_pos_pct + '%)' }) })
  if (numSectors < cfg.min_sectors) recs.push({ t: 'warn', c: 'Diversificación', x: 'Tenés ' + numSectors + ' sectores (mín ' + cfg.min_sectors + ')' })
  wv.filter(x => x.type !== 'cash' && x.avg_cost > 0).forEach(x => { const r = ((x.current_price / x.avg_cost) - 1) * 100; if (r < cfg.momentum_warn_pct) recs.push({ t: 'bad', c: 'Momentum', x: x.ticker + ' en ' + r.toFixed(1) + '%' }) })
  if (corrScore > 0.8) recs.push({ t: 'warn', c: 'Correlación', x: 'Alta correlación con S&P (' + (corrScore * 100).toFixed(0) + '%)' })
  const defensive = ['Utilities', 'Consumo Básico', 'Salud']
  const hasDef = defensive.some(d => sectors[d])
  if (!hasDef && numSectors > 0) recs.push({ t: 'info', c: 'Sugerencia', x: 'Considerá sectores defensivos: Utilities, Consumo Básico, Salud' })
  const topPerf = wv.filter(x => x.type !== 'cash' && x.avg_cost > 0 && ((x.current_price / x.avg_cost) - 1) * 100 > 15)
  topPerf.forEach(x => recs.push({ t: 'good', c: 'Top', x: x.ticker + ' rinde ' + (((x.current_price / x.avg_cost) - 1) * 100).toFixed(1) + '%' }))
  if (!recs.length) recs.push({ t: 'good', c: 'General', x: 'Portafolio equilibrado ✓' })

  return { score, dS, cS, mS, corrScore, recs }
}
