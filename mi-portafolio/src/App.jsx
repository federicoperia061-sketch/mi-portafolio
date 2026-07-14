import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { usePortfolio } from './hooks/usePortfolio'
import { lookupCedear, CD } from './utils/cedears'
import { fetchCandles, fetchGeneralNews, fetchCompanyNews } from './utils/finnhub'
import { analyze } from './utils/analysis'
import { fu, fp, AT, SECTORS, DBG, CBG, BDR, T1, T2, T3, GRN, RED, BLU, AMB, PUR, M, PAL, cs, ls, is } from './utils/format'
import ExcelJS from 'exceljs'

/* ========== SMALL COMPONENTS ========== */
function SC({ l, sub, children }) {
  return <div style={{ ...cs, borderRadius: 12, padding: '14px 18px', minWidth: 120, flex: '1 1 auto' }}>
    <div style={{ fontSize: 11, color: T3, marginBottom: 6, fontFamily: M }}>{l}</div>
    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: M, color: T1 }}>{children}</div>
    {sub && <div style={{ fontSize: 10, color: T3, marginTop: 4 }}>{sub}</div>}
  </div>
}

function PnL({ v, s }) {
  if (v == null) return <span style={{ color: T3, ...s }}>—</span>
  return <span style={{ color: v >= 0 ? GRN : RED, fontFamily: M, ...s }}>{v >= 0 ? '+' : ''}{fu(v)}</span>
}

function Pc({ v, s }) {
  if (v == null) return <span style={{ color: T3, ...s }}>—</span>
  return <span style={{ color: v >= 0 ? GRN : RED, fontFamily: M, ...s }}>{fp(v)}</span>
}

function Donut({ data }) {
  if (!data || !data.length) return null
  const r = 60, cx = 75, cy = 75
  let acc = 0
  const paths = data.map((d, i) => {
    const a1 = acc * 2 * Math.PI; acc += d.pct / 100; const a2 = acc * 2 * Math.PI
    const la = d.pct > 50 ? 1 : 0
    const x1 = cx + r * Math.sin(a1), y1 = cy - r * Math.cos(a1)
    const x2 = cx + r * Math.sin(a2), y2 = cy - r * Math.cos(a2)
    const ir = 35, ix1 = cx + ir * Math.sin(a2), iy1 = cy - ir * Math.cos(a2)
    const ix2 = cx + ir * Math.sin(a1), iy2 = cy - ir * Math.cos(a1)
    return <path key={i} d={`M${x1},${y1} A${r},${r} 0 ${la},1 ${x2},${y2} L${ix1},${iy1} A${ir},${ir} 0 ${la},0 ${ix2},${iy2} Z`} fill={d.color} />
  })
  return <svg width="150" height="150" viewBox="0 0 150 150">{paths}</svg>
}

function LineChart({ data, lines, W, H, zeroCenter }) {
  if (!data || data.length < 1) return null; W = W || 700; H = H || 280
  const p = { t: 30, r: 20, b: 40, l: 55 }; const cw = W - p.l - p.r, ch = H - p.t - p.b
  const vals = []; lines.forEach(ln => { data.forEach(d => { const v = d[ln.key]; if (v != null && !isNaN(v)) vals.push(v) }) })
  if (!vals.length) return null
  let mn = Math.min(...vals), mx = Math.max(...vals)
  if (mn === mx) { mn -= 1; mx += 1 }
  if (zeroCenter) { const ab = Math.max(Math.abs(mn), Math.abs(mx), 0.5); mn = -ab; mx = ab }
  let rng = mx - mn; mn -= rng * .1; mx += rng * .1; rng = mx - mn
  const xP = i => p.l + (data.length > 1 ? (i / (data.length - 1)) * cw : cw / 2)
  const yP = v => p.t + ch - ((v - mn) / rng) * ch
  const grid = []; const steps = 5
  for (let i = 0; i <= steps; i++) {
    const v = mn + (rng * i / steps); const y = yP(v)
    grid.push(<line key={'g' + i} x1={p.l} y1={y} x2={p.l + cw} y2={y} stroke="rgba(255,255,255,.06)" />)
    grid.push(<text key={'t' + i} x={p.l - 8} y={y + 4} fill={T3} fontSize="10" fontFamily={M} textAnchor="end">{v.toFixed(1)}</text>)
  }
  const xl = data.filter((_, i) => data.length <= 12 || i % Math.ceil(data.length / 10) === 0).map((d, i) => (
    <text key={'xl' + i} x={xP(data.indexOf(d))} y={H - 8} fill={T3} fontSize="9" fontFamily={M} textAnchor="middle">{d.label}</text>
  ))
  const lns = lines.map(ln => {
    const pts = data.map((d, i) => d[ln.key] != null ? [xP(i), yP(d[ln.key])] : null).filter(Boolean)
    if (!pts.length) return null
    const pathD = pts.map((pt, i) => (i === 0 ? 'M' : 'L') + pt[0] + ',' + pt[1]).join(' ')
    const elems = [<path key={ln.key} d={pathD} fill="none" stroke={ln.color} strokeWidth={ln.w || 2} strokeDasharray={ln.dash || ''} />]
    if (ln.area) {
      const areaD = pathD + ' L' + pts[pts.length - 1][0] + ',' + (p.t + ch) + ' L' + pts[0][0] + ',' + (p.t + ch) + ' Z'
      elems.unshift(<path key={ln.key + 'a'} d={areaD} fill={ln.color} opacity="0.08" />)
    }
    if (pts.length > 0) {
      const last = pts[pts.length - 1]
      elems.push(<circle key={ln.key + 'c'} cx={last[0]} cy={last[1]} r="4" fill={ln.color} />)
    }
    return elems
  })
  const zy = yP(0); const showZ = (mn < 0 && mx > 0) || zeroCenter
  return <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>{grid}{showZ && <line x1={p.l} y1={zy} x2={p.l + cw} y2={zy} stroke={zeroCenter ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.15)'} strokeWidth={zeroCenter ? 1.5 : 1} strokeDasharray="4 4" />}{showZ && zeroCenter && <text x={p.l - 8} y={zy + 4} fill={T2} fontSize="10" fontFamily={M} textAnchor="end" fontWeight="600">0%</text>}{xl}{lns}</svg>
}

function Gauge({ score }) {
  const cl = score >= 75 ? GRN : score >= 50 ? AMB : score >= 25 ? '#FF6D00' : RED
  const lb = score >= 75 ? 'Saludable' : score >= 50 ? 'Aceptable' : score >= 25 ? 'Mejorable' : 'Riesgoso'
  const r = 70, ci = 2 * Math.PI * r, da = ci * (score / 100)
  return <div style={{ textAlign: 'center', marginBottom: 12 }}>
    <svg width="160" height="100" viewBox="0 0 160 100">
      <circle cx="80" cy="90" r={r} fill="none" stroke="#1e293b" strokeWidth="10" strokeDasharray={ci / 2 + ' ' + ci} strokeLinecap="round" transform="rotate(180,80,90)" />
      <circle cx="80" cy="90" r={r} fill="none" stroke={cl} strokeWidth="10" strokeDasharray={da / 2 + ' ' + ci} strokeLinecap="round" transform="rotate(180,80,90)" />
      <text x="80" y="75" textAnchor="middle" fill={T1} fontSize="28" fontWeight="700" fontFamily={M}>{score}</text>
      <text x="80" y="92" textAnchor="middle" fill={cl} fontSize="11" fontFamily={M}>{lb}</text>
    </svg>
  </div>
}

/* ========== AUTH COMPONENT ========== */
function Auth() {
  const [loading, setLoading] = useState(false)
  async function signIn() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }
  return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: DBG }}>
    <div style={{ ...cs, borderRadius: 20, padding: '48px 40px', textAlign: 'center', maxWidth: 400 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: T1 }}>Mi Portafolio</h1>
      <p style={{ color: T3, fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
        Tracker personal de inversiones con precios en tiempo real, análisis de cartera y noticias de mercado.
      </p>
      <button onClick={signIn} disabled={loading} style={{
        background: '#fff', color: '#333', border: 'none', borderRadius: 10,
        padding: '14px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10, margin: '0 auto'
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
        {loading ? 'Cargando...' : 'Iniciar con Google'}
      </button>
      <p style={{ color: T3, fontSize: 11, marginTop: 24 }}>Tus datos son privados y solo vos podés verlos.</p>
    </div>
  </div>
}

/* ========== ADD FORM ========== */
function AddForm({ onAdd, onCancel }) {
  const [f, sF] = useState({ ticker: '', type: 'stock_us', shares: '', avgCost: '', date: new Date().toISOString().split('T')[0], sector: 'Tecnología', currentPrice: '', cedearRatio: '', cedearUS: '' })
  const [err, sE] = useState('')
  const [autoR, sAR] = useState(null)
  const iC = f.type === 'cedear'
  const isCash = f.type === 'cash'
  function hTk(v) { sF(p => ({ ...p, ticker: v })); if (iC) { const r = lookupCedear(v.trim()); sAR(r.found ? r : null); if (r.found) sF(p => ({ ...p, cedearRatio: String(r.ratio), cedearUS: r.us })) } }
  function hTy(v) { sF(p => ({ ...p, type: v })); if (v === 'cedear') { const r = lookupCedear(f.ticker.trim()); sAR(r.found ? r : null); if (r.found) sF(p => ({ ...p, cedearRatio: String(r.ratio), cedearUS: r.us })) } else { sAR(null); sF(p => ({ ...p, cedearRatio: '', cedearUS: '' })) } }
  function sub() {
    if (isCash) {
      if (!f.shares || +f.shares <= 0) return sE('Monto')
      sE('')
      onAdd({ ticker: 'CASH', type: 'cash', shares: +f.shares, avg_cost: 1, date_added: f.date, sector: 'Cash', current_price: 1, cedear_ratio: null, cedear_us: null, lots: [{ type: 'buy', shares: +f.shares, price: 1, date: f.date }] })
      return
    }
    if (!f.ticker.trim()) return sE('Ticker')
    if (!f.shares || +f.shares <= 0) return sE('Cantidad')
    if (!f.avgCost || +f.avgCost <= 0) return sE('Costo')
    if (iC && (!f.cedearRatio || +f.cedearRatio <= 0)) return sE('Ratio')
    sE('')
    onAdd({ ticker: f.ticker.toUpperCase().trim(), type: f.type, shares: +f.shares, avg_cost: +f.avgCost, date_added: f.date, sector: f.sector, current_price: f.currentPrice ? +f.currentPrice : null, cedear_ratio: iC ? +f.cedearRatio : null, cedear_us: iC ? (f.cedearUS || f.ticker.toUpperCase().trim()) : null, lots: [{ type: 'buy', shares: +f.shares, price: +f.avgCost, date: f.date }] })
  }
  const eqCalc = iC && f.shares && f.cedearRatio ? +f.shares / +f.cedearRatio : null
  const ratioDisplay = f.cedearRatio && +f.cedearRatio < 1 ? '1:' + Math.round(1 / +f.cedearRatio) : f.cedearRatio + ':1'
  return <div style={{ ...cs, borderRadius: 14, padding: 24, marginBottom: 20 }}>
    <h3 style={{ color: T1, margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>{isCash ? 'Agregar efectivo' : 'Agregar posición'}</h3>
    {err && <div style={{ color: RED, fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(255,82,82,.1)', borderRadius: 8 }}>Completá: {err}</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14 }}>
      <div><label style={ls}>Tipo</label><select style={{ ...is, cursor: 'pointer' }} value={f.type} onChange={e => hTy(e.target.value)}>{AT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
      {isCash && <div><label style={ls}>Monto (USD)</label><input style={is} type="number" step="0.01" placeholder="5000" value={f.shares} onChange={e => sF(p => ({ ...p, shares: e.target.value }))} /></div>}
      {!isCash && <div><label style={ls}>Ticker</label><input style={is} placeholder="AAPL" value={f.ticker} onChange={e => hTk(e.target.value)} /></div>}
      {!isCash && <div><label style={ls}>{iC ? 'Cant. CEDEARs' : 'Cantidad'}</label><input style={is} type="number" step="any" value={f.shares} onChange={e => sF(p => ({ ...p, shares: e.target.value }))} /></div>}
      {!isCash && <div><label style={ls}>{iC ? 'Precio x CEDEAR (USD)' : 'Costo prom. (USD)'}</label><input style={is} type="number" step="0.01" value={f.avgCost} onChange={e => sF(p => ({ ...p, avgCost: e.target.value }))} /></div>}
      {iC && <div><label style={ls}>Ratio</label><input style={{ ...is, borderColor: autoR ? 'rgba(0,230,118,.4)' : BDR }} type="number" step="any" value={f.cedearRatio} onChange={e => { sF(p => ({ ...p, cedearRatio: e.target.value })); sAR(null) }} />{autoR ? <div style={{ fontSize: 10, color: GRN, marginTop: 4, fontFamily: M }}>✓ {ratioDisplay} · US: {autoR.us}</div> : f.ticker.trim() ? <div style={{ fontSize: 10, color: AMB, marginTop: 4 }}>No encontrado</div> : null}</div>}
      {iC && <div><label style={ls}>Ticker US</label><input style={is} value={f.cedearUS} onChange={e => sF(p => ({ ...p, cedearUS: e.target.value }))} /></div>}
      {!isCash && <div><label style={ls}>Precio actual</label><input style={is} type="number" step="0.01" placeholder="Auto" value={f.currentPrice} onChange={e => sF(p => ({ ...p, currentPrice: e.target.value }))} /></div>}
      <div><label style={ls}>Fecha</label><input style={is} type="date" value={f.date} onChange={e => sF(p => ({ ...p, date: e.target.value }))} /></div>
      {!isCash && <div><label style={ls}>Sector</label><select style={{ ...is, cursor: 'pointer' }} value={f.sector} onChange={e => sF(p => ({ ...p, sector: e.target.value }))}>{SECTORS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>}
    </div>
    {iC && eqCalc && <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(68,138,255,.08)', border: '1px solid rgba(68,138,255,.2)', borderRadius: 8, fontSize: 12, color: T2 }}><strong style={{ color: BLU }}>≈</strong> {eqCalc.toFixed(4)} acciones US · Ratio {ratioDisplay}</div>}
    <div style={{ display: 'flex', gap: 10, marginTop: 18 }}><button onClick={sub} style={{ background: GRN, color: DBG, border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: M }}>Agregar</button><button onClick={onCancel} style={{ background: 'transparent', color: T2, border: '1px solid ' + BDR, borderRadius: 8, padding: '10px 24px', fontSize: 14, cursor: 'pointer', fontFamily: M }}>Cancelar</button></div>
  </div>
}

/* ========== HOLDINGS TABLE ========== */
function HT({ h, onD, onEdit }) {
  const [editId, setEditId] = useState(null)
  const [ef, setEf] = useState({})
  const [lots, setLots] = useState([])
  const [newLot, setNewLot] = useState({ type: 'buy', shares: '', price: '', date: new Date().toISOString().split('T')[0] })

  function startEdit(x) {
    setEditId(x.id)
    setEf({ ticker: x.ticker, type: x.type, sector: x.sector, cedear_ratio: x.cedear_ratio ? String(x.cedear_ratio) : '', cedear_us: x.cedear_us || '', current_price: x.current_price ? String(x.current_price) : '' })
    setLots(x.lots || [{ type: 'buy', shares: x.shares, price: x.avg_cost, date: x.date_added || '—' }])
    setNewLot({ type: 'buy', shares: '', price: '', date: new Date().toISOString().split('T')[0] })
  }
  function addLot() {
    if (!newLot.shares || +newLot.shares <= 0 || !newLot.price || +newLot.price <= 0) return
    setLots(prev => [...prev, { type: newLot.type, shares: +newLot.shares, price: +newLot.price, date: newLot.date }])
    setNewLot({ type: 'buy', shares: '', price: '', date: new Date().toISOString().split('T')[0] })
  }
  function removeLot(idx) { setLots(prev => prev.filter((_, i) => i !== idx)) }

  let totalShares = 0, totalCost = 0
  lots.forEach(l => { if (l.type === 'buy') { totalShares += l.shares; totalCost += l.shares * l.price } else { totalShares -= l.shares; totalCost -= l.shares * l.price } })
  totalShares = Math.max(0, totalShares)
  const ppc = totalShares > 0 ? totalCost / totalShares : 0

  function saveEdit() {
    const iC = ef.type === 'cedear'
    onEdit(editId, { ticker: ef.ticker.toUpperCase().trim(), type: ef.type, shares: totalShares, avg_cost: ppc, sector: ef.sector, cedear_ratio: iC && ef.cedear_ratio ? +ef.cedear_ratio : null, cedear_us: iC ? ef.cedear_us || ef.ticker.toUpperCase().trim() : null, current_price: ef.current_price ? +ef.current_price : null, lots })
    setEditId(null)
  }

  if (!h.length) return <div style={{ ...cs, borderRadius: 14, padding: '48px 24px', textAlign: 'center', color: T3 }}><div style={{ fontSize: 40, marginBottom: 12 }}>📊</div><div>Portafolio vacío</div></div>

  const eis = { background: '#0f172a', border: '1px solid ' + BDR, borderRadius: 6, padding: '6px 8px', color: T1, fontSize: 12, outline: 'none', fontFamily: M, width: '100%', boxSizing: 'border-box' }

  return <div style={{ ...cs, borderRadius: 14, overflow: 'hidden', padding: 0 }}>
    {editId && <div style={{ padding: 16, borderBottom: '1px solid ' + BDR, background: 'rgba(68,138,255,.04)' }}>
      <div style={{ fontSize: 13, color: BLU, fontWeight: 700, marginBottom: 14, fontFamily: M }}>✏️ Editando: {ef.ticker}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 16 }}>
        <div><label style={ls}>Ticker</label><input style={eis} value={ef.ticker} onChange={e => setEf(p => ({ ...p, ticker: e.target.value }))} /></div>
        <div><label style={ls}>Tipo</label><select style={{ ...eis, cursor: 'pointer' }} value={ef.type} onChange={e => setEf(p => ({ ...p, type: e.target.value }))}>{AT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        {ef.type === 'cedear' && <div><label style={ls}>Ratio</label><input style={eis} type="number" step="any" value={ef.cedear_ratio} onChange={e => setEf(p => ({ ...p, cedear_ratio: e.target.value }))} /></div>}
        {ef.type === 'cedear' && <div><label style={ls}>Ticker US</label><input style={eis} value={ef.cedear_us} onChange={e => setEf(p => ({ ...p, cedear_us: e.target.value }))} /></div>}
        <div><label style={ls}>Precio actual</label><input style={eis} type="number" step="0.01" value={ef.current_price} onChange={e => setEf(p => ({ ...p, current_price: e.target.value }))} /></div>
        <div><label style={ls}>Sector</label><select style={{ ...eis, cursor: 'pointer' }} value={ef.sector} onChange={e => setEf(p => ({ ...p, sector: e.target.value }))}>{SECTORS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
      </div>
      <div style={{ background: 'rgba(0,0,0,.2)', borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 11, color: T1, fontWeight: 600, marginBottom: 10, fontFamily: M }}>Lotes de compra/venta</div>
        {lots.length > 0 && <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 12 }}>
          <thead><tr style={{ borderBottom: '1px solid ' + BDR }}>{['', 'Cant.', 'Precio', 'Capital', 'Fecha', ''].map(c => <th key={c} style={{ padding: '6px 8px', textAlign: 'left', color: T3, fontSize: 9, fontFamily: M, fontWeight: 600, textTransform: 'uppercase' }}>{c}</th>)}</tr></thead>
          <tbody>{lots.map((l, i) => <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
            <td style={{ padding: '6px 8px' }}><span style={{ fontSize: 10, fontWeight: 600, color: l.type === 'buy' ? GRN : RED, fontFamily: M }}>{l.type === 'buy' ? 'COMPRA' : 'VENTA'}</span></td>
            <td style={{ padding: '6px 8px', fontFamily: M, color: T1 }}>{l.shares}</td>
            <td style={{ padding: '6px 8px', fontFamily: M, color: T1 }}>{fu(l.price)}</td>
            <td style={{ padding: '6px 8px', fontFamily: M, color: l.type === 'buy' ? T2 : RED }}>{l.type === 'buy' ? '' : '-'}{fu(l.shares * l.price)}</td>
            <td style={{ padding: '6px 8px', color: T3, fontSize: 10 }}>{l.date || '—'}</td>
            <td style={{ padding: '6px 8px' }}>{lots.length > 1 && <button onClick={() => removeLot(i)} style={{ background: 'transparent', border: 'none', color: RED, cursor: 'pointer', fontSize: 11, padding: 2 }}>✕</button>}</td>
          </tr>)}</tbody>
        </table>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div><label style={{ ...ls, fontSize: 9 }}>Tipo</label><select style={{ ...eis, width: 85, fontSize: 11 }} value={newLot.type} onChange={e => setNewLot(p => ({ ...p, type: e.target.value }))}><option value="buy">Compra</option><option value="sell">Venta</option></select></div>
          <div><label style={{ ...ls, fontSize: 9 }}>Cantidad</label><input style={{ ...eis, width: 80, fontSize: 11 }} type="number" step="any" value={newLot.shares} onChange={e => setNewLot(p => ({ ...p, shares: e.target.value }))} /></div>
          <div><label style={{ ...ls, fontSize: 9 }}>Precio</label><input style={{ ...eis, width: 80, fontSize: 11 }} type="number" step="0.01" value={newLot.price} onChange={e => setNewLot(p => ({ ...p, price: e.target.value }))} /></div>
          <div><label style={{ ...ls, fontSize: 9 }}>Fecha</label><input style={{ ...eis, width: 120, fontSize: 11 }} type="date" value={newLot.date} onChange={e => setNewLot(p => ({ ...p, date: e.target.value }))} /></div>
          <button onClick={addLot} style={{ background: BLU, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: M }}>+ Lote</button>
        </div>
        <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(0,230,118,.06)', border: '1px solid rgba(0,230,118,.15)', borderRadius: 8, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 9, color: T3, fontFamily: M }}>CANTIDAD</div><div style={{ fontFamily: M, fontSize: 14, fontWeight: 700, color: T1 }}>{totalShares.toFixed(4)}</div></div>
          <div><div style={{ fontSize: 9, color: T3, fontFamily: M }}>CAPITAL</div><div style={{ fontFamily: M, fontSize: 14, fontWeight: 700, color: T1 }}>{fu(totalCost)}</div></div>
          <div><div style={{ fontSize: 9, color: T3, fontFamily: M }}>PPC</div><div style={{ fontFamily: M, fontSize: 14, fontWeight: 700, color: GRN }}>{fu(ppc)}</div></div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={saveEdit} style={{ background: GRN, color: DBG, border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: M }}>Guardar</button>
        <button onClick={() => setEditId(null)} style={{ background: 'transparent', color: T2, border: '1px solid ' + BDR, borderRadius: 6, padding: '8px 18px', fontSize: 12, cursor: 'pointer', fontFamily: M }}>Cancelar</button>
      </div>
    </div>}
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr style={{ borderBottom: '1px solid ' + BDR }}>
      {['Ticker', 'Tipo', 'Cant.', 'PPC', 'Costo US', 'Precio Act.', 'Día %', 'Precio US', 'Valor Total', 'P&L $', 'Rend. %', ''].map(x => <th key={x} style={{ padding: ['Costo US', 'PPC', 'Precio US'].includes(x) ? '10px 8px' : '10px 12px', textAlign: x === 'Tipo' ? 'center' : 'left', color: T3, fontSize: 9, textTransform: 'uppercase', letterSpacing: ['Costo US', 'PPC', 'Precio US'].includes(x) ? 0 : 1, fontFamily: M, fontWeight: 600, whiteSpace: 'nowrap' }}>{x}</th>)}
    </tr></thead>
      <tbody>{h.map((x, i) => {
        const isCed = x.type === 'cedear' && x.cedear_ratio
        const ratio = isCed ? x.cedear_ratio : 1
        const costoUS = x.avg_cost * ratio
        const precioAct = x.current_price || null
        const precioUS = precioAct ? precioAct * ratio : null
        const valor = precioAct ? x.shares * precioAct : null
        const pnlDollar = precioAct && x.type !== 'cash' ? (precioAct - x.avg_cost) * x.shares : null
        const rendPct = precioAct && x.avg_cost > 0 ? ((precioAct / x.avg_cost) - 1) * 100 : null
        const tl = (AT.find(t => t.value === x.type) || {}).label || x.type
        const tc2 = x.type === 'crypto' ? '#E040FB' : x.type === 'etf' ? BLU : x.type === 'cedear' ? '#FFEA00' : GRN
        const tb = x.type === 'crypto' ? 'rgba(224,64,251,.15)' : x.type === 'etf' ? 'rgba(68,138,255,.15)' : x.type === 'cedear' ? 'rgba(255,234,0,.15)' : 'rgba(0,230,118,.15)'
        const eq = isCed ? (x.shares / x.cedear_ratio).toFixed(2) : null
        const rd = isCed ? (x.cedear_ratio < 1 ? '1:' + Math.round(1 / x.cedear_ratio) : x.cedear_ratio + ':1') : ''
        return <tr key={x.id} style={{ borderBottom: '1px solid ' + BDR, background: editId === x.id ? 'rgba(68,138,255,.06)' : i % 2 ? 'rgba(255,255,255,.01)' : 'transparent' }}>
          <td style={{ padding: '10px 12px', fontFamily: M }}><span style={{ color: T1, fontWeight: 700 }}>{x.ticker}</span>{isCed && <div style={{ fontSize: 10, color: BLU, marginTop: 2 }}>≈{eq} acc · {rd}</div>}</td>
          <td style={{ padding: '10px 12px', textAlign: 'center' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: tb, color: tc2, textTransform: 'uppercase' }}>{tl}</span></td>
          <td style={{ padding: '10px 12px', color: T1, fontFamily: M }}>{x.shares}</td>
          <td style={{ padding: '10px 8px', color: T1, fontFamily: M, fontSize: 11 }}>{fu(x.avg_cost)}</td>
          <td style={{ padding: '10px 8px', color: T2, fontFamily: M, fontSize: 10 }}>{fu(costoUS)}</td>
          <td style={{ padding: '10px 12px', fontFamily: M }}>{precioAct ? <span style={{ color: T1 }}>{fu(precioAct)}</span> : <span style={{ color: T3, fontSize: 11 }}>—</span>}</td>
          <td style={{ padding: '10px 12px', fontFamily: M }}>{x.day_change != null && x.type !== 'cash' ? <span style={{ color: x.day_change >= 0 ? GRN : RED, fontSize: 12 }}>{x.day_change >= 0 ? '+' : ''}{(+x.day_change).toFixed(2)}%</span> : <span style={{ color: T3, fontSize: 11 }}>—</span>}</td>
          <td style={{ padding: '10px 8px', color: T2, fontFamily: M, fontSize: 10 }}>{precioUS ? fu(precioUS) : '—'}</td>
          <td style={{ padding: '10px 12px', color: T1, fontFamily: M, fontWeight: 600 }}>{valor != null ? fu(valor) : '—'}</td>
          <td style={{ padding: '10px 12px' }}><PnL v={pnlDollar} /></td>
          <td style={{ padding: '10px 12px' }}><Pc v={rendPct} /></td>
          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
            <button onClick={() => startEdit(x)} style={{ background: 'transparent', border: '1px solid ' + BDR, borderRadius: 6, color: T2, padding: '4px 8px', cursor: 'pointer', fontSize: 11, marginRight: 6 }}>✏️</button>
            <button onClick={() => { if (confirm('¿Eliminar ' + x.ticker + '?')) onD(x.id) }} style={{ background: 'transparent', border: '1px solid rgba(255,82,82,.3)', borderRadius: 6, color: RED, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>✕</button>
          </td>
        </tr>
      })}
        {(() => {
          let tValor = 0, tPnl = 0, tCostoUS = 0
          h.forEach(x => { const pa = x.current_price || null; tValor += pa ? x.shares * pa : x.shares * x.avg_cost; tPnl += pa && x.type !== 'cash' ? (pa - x.avg_cost) * x.shares : 0; tCostoUS += x.shares * x.avg_cost })
          const capital = tValor - tPnl; const rendTotal = capital > 0 ? (tPnl / capital) * 100 : null
          return [
            <tr key="sp1"><td colSpan={12} style={{ padding: 0, height: 12, background: 'transparent', border: 'none' }}></td></tr>,
            <tr key="sp2"><td colSpan={12} style={{ padding: 0, height: 1, background: 'rgba(0,230,118,.2)', border: 'none' }}></td></tr>,
            <tr key="sp3"><td colSpan={12} style={{ padding: 0, height: 8, background: 'transparent', border: 'none' }}></td></tr>,
            <tr key="tot" style={{ background: 'rgba(0,230,118,.03)' }}>
              <td colSpan={4} style={{ padding: '16px 12px' }}><div style={{ fontFamily: M, fontWeight: 700, color: GRN, fontSize: 14 }}>RESUMEN CARTERA</div><div style={{ fontSize: 10, color: T3, marginTop: 4 }}>{h.length} posiciones</div></td>
              <td style={{ padding: '16px 12px', verticalAlign: 'top' }}><div style={{ fontSize: 10, color: T3, fontFamily: M, letterSpacing: 1, marginBottom: 4 }}>CAPITAL INVERTIDO</div><div style={{ fontFamily: M, fontWeight: 700, color: T1, fontSize: 16 }}>{fu(tCostoUS)}</div></td>
              <td colSpan={3} style={{ padding: '16px 12px' }}></td>
              <td style={{ padding: '16px 12px', verticalAlign: 'top' }}><div style={{ fontSize: 10, color: T3, fontFamily: M, letterSpacing: 1, marginBottom: 4 }}>VALOR ACTUAL</div><div style={{ fontFamily: M, fontWeight: 700, color: T1, fontSize: 16 }}>{fu(tValor)}</div></td>
              <td style={{ padding: '16px 12px', verticalAlign: 'top' }}><div style={{ fontSize: 10, color: T3, fontFamily: M, letterSpacing: 1, marginBottom: 4 }}>GANANCIA/PÉRDIDA</div><PnL v={tPnl} s={{ fontSize: 16, fontWeight: 700 }} /></td>
              <td style={{ padding: '16px 12px', verticalAlign: 'top' }}><div style={{ fontSize: 10, color: T3, fontFamily: M, letterSpacing: 1, marginBottom: 4 }}>RENDIMIENTO</div><Pc v={rendTotal} s={{ fontSize: 16, fontWeight: 700 }} /></td>
              <td></td>
            </tr>
          ]
        })()}
      </tbody></table></div></div>
}

/* ========== MAIN APP ========== */
export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (authLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: DBG, color: T3 }}>Cargando...</div>
  if (!user) return <Auth />
  return <Dashboard user={user} />
}

/* ========== WEIGHT PIES (Donuts) ========== */
function WP({ h }) {
  const wv = h.filter(x => x.current_price)
  if (!wv.length) return null
  const tv = wv.reduce((s, x) => s + x.shares * x.current_price, 0)
  const byTicker = wv.map((x, i) => ({ name: x.ticker, value: x.shares * x.current_price, pct: (x.shares * x.current_price / tv) * 100, color: PAL[i % PAL.length] })).sort((a, b) => b.value - a.value)
  const sectorMap = {}
  wv.forEach(x => { const s = x.type === 'cash' ? 'Cash' : x.sector; sectorMap[s] = (sectorMap[s] || 0) + x.shares * x.current_price })
  const bySector = Object.entries(sectorMap).map(([k, v], i) => ({ name: k, value: v, pct: (v / tv) * 100, color: PAL[(i + 5) % PAL.length] })).sort((a, b) => b.value - a.value)
  function legend(data) { return data.map((d, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} /><span style={{ color: T1, fontFamily: M, fontSize: 11, fontWeight: 600, flex: 1 }}>{d.name}</span><span style={{ color: T2, fontFamily: M, fontSize: 11 }}>{d.pct.toFixed(1)}%</span></div>) }
  return <div style={{ ...cs, borderRadius: 14, padding: 20 }}><div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
    <div style={{ flex: '1 1 280px', minWidth: 240 }}><h4 style={{ color: T1, margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>Ponderación por activo</h4><div style={{ display: 'flex', alignItems: 'center', gap: 16 }}><Donut data={byTicker} /><div style={{ flex: 1, minWidth: 120 }}>{legend(byTicker)}</div></div></div>
    <div style={{ flex: '1 1 280px', minWidth: 240 }}><h4 style={{ color: T1, margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>Exposición por sector</h4><div style={{ display: 'flex', alignItems: 'center', gap: 16 }}><Donut data={bySector} /><div style={{ flex: 1, minWidth: 120 }}>{legend(bySector)}</div></div></div>
  </div></div>
}

/* ========== TRANSACTION HISTORY ========== */
function TxHist({ h }) {
  const txs = []
  h.forEach(x => {
    if (x.lots && x.lots.length > 0) x.lots.forEach(l => txs.push({ ticker: x.ticker, action: l.type, shares: l.shares, price: l.price, capital: l.shares * l.price, date: l.date || '—' }))
    else txs.push({ ticker: x.ticker, action: 'buy', shares: x.shares, price: x.avg_cost, capital: x.shares * x.avg_cost, date: x.date_added || '—' })
  })
  if (!txs.length) return null
  txs.sort((a, b) => a.date < b.date ? 1 : -1)
  return <div style={{ ...cs, borderRadius: 14, padding: 20 }}>
    <h3 style={{ color: T1, margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Historial de transacciones ({txs.length})</h3>
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead><tr style={{ borderBottom: '1px solid ' + BDR }}>{['Fecha', 'Ticker', 'Operación', 'Cantidad', 'Precio', 'Capital'].map(c => <th key={c} style={{ padding: '8px 10px', textAlign: 'left', color: T3, fontSize: 9, textTransform: 'uppercase', fontFamily: M, fontWeight: 600 }}>{c}</th>)}</tr></thead>
      <tbody>{txs.map((tx, i) => <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
        <td style={{ padding: '8px 10px', color: T2, fontFamily: M, fontSize: 11 }}>{tx.date}</td>
        <td style={{ padding: '8px 10px', fontFamily: M, fontWeight: 600, color: T1 }}>{tx.ticker}</td>
        <td style={{ padding: '8px 10px' }}><span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, fontFamily: M, color: tx.action === 'buy' ? GRN : RED, background: tx.action === 'buy' ? 'rgba(0,230,118,.1)' : 'rgba(255,82,82,.1)' }}>{tx.action === 'buy' ? 'COMPRA' : 'VENTA'}</span></td>
        <td style={{ padding: '8px 10px', fontFamily: M, color: T1 }}>{tx.shares}</td>
        <td style={{ padding: '8px 10px', fontFamily: M, color: T1 }}>{fu(tx.price)}</td>
        <td style={{ padding: '8px 10px', fontFamily: M, fontWeight: 600, color: tx.action === 'buy' ? T1 : RED }}>{tx.action === 'sell' ? '-' : ''}{fu(tx.capital)}</td>
      </tr>)}</tbody>
    </table></div>
  </div>
}

/* ========== MARKET NEWS ========== */
function MarketNews({ cfg }) {
  const [news, setNews] = useState(null)
  const [loading, setLoading] = useState(false)
  const catIcon = { mercados: '📊', commodities: '🛢️', geopolítica: '🌍', empresas: '🏢', cripto: '₿', macro: '🏛️' }
  async function loadNews() {
    if (!cfg.finnhub_key) return
    setLoading(true)
    const result = await fetchGeneralNews(cfg.finnhub_key)
    if (result && result.length) setNews(result)
    setLoading(false)
  }
  return <div style={{ ...cs, borderRadius: 14, padding: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <h3 style={{ color: T1, margin: 0, fontSize: 14, fontWeight: 600 }}>📰 Noticias</h3>
      <button onClick={loadNews} disabled={loading || !cfg.finnhub_key} style={{ background: 'transparent', border: '1px solid ' + BDR, borderRadius: 6, color: loading ? T3 : T2, padding: '6px 14px', fontSize: 11, cursor: loading ? 'wait' : 'pointer', fontFamily: M }}>{loading ? '...' : '⟳'}</button>
    </div>
    {news && news.length > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {news.map((n, i) => <div key={i} style={{ background: 'rgba(255,255,255,.02)', border: '1px solid ' + BDR, borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>{catIcon[n.category] || '📰'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {n.url ? <a href={n.url} target="_blank" rel="noopener" style={{ fontSize: 11, color: T1, fontWeight: 600, lineHeight: 1.3, display: 'block', textDecoration: 'none' }}>{n.headline}</a> : <div style={{ fontSize: 11, color: T1, fontWeight: 600, lineHeight: 1.3 }}>{n.headline}</div>}
          <div style={{ display: 'flex', gap: 6, fontSize: 9, color: T3, marginTop: 3, fontFamily: M }}>{n.source && <span>{n.source}</span>}{n.time && <span>· {n.time}</span>}</div>
        </div>
      </div>)}
    </div> : (!loading && <div style={{ textAlign: 'center', color: T3, padding: 12, fontSize: 11 }}>Tocá ⟳</div>)}
  </div>
}

/* ========== RECOMMENDATIONS PANEL ========== */
function RP({ h, cfg }) {
  const wv = h.filter(x => x.current_price)
  const [compNews, setCompNews] = useState(null)
  const [cnLoading, setCnLoading] = useState(false)
  async function loadCN() {
    if (!cfg.finnhub_key) return
    const stocks = h.filter(x => x.type !== 'cash' && x.current_price)
    if (!stocks.length) return
    setCnLoading(true)
    const results = []
    for (let i = 0; i < stocks.length; i++) {
      const x = stocks[i]; const usTicker = x.cedear_us || x.ticker
      const news = await fetchCompanyNews(usTicker, cfg.finnhub_key)
      if (news.length) results.push({ ticker: x.ticker, usTicker, news })
      if (i < stocks.length - 1) await new Promise(r => setTimeout(r, 200))
    }
    setCompNews(results); setCnLoading(false)
  }
  if (!wv.length) return <div style={{ ...cs, borderRadius: 14, padding: '20px 16px', textAlign: 'center', color: T3, fontSize: 12 }}>Cargá precios primero</div>
  const r = analyze(h, cfg)
  const ic = { good: '✅', warn: '⚠️', bad: '🔴', info: '💡' }
  const bgc = { good: 'rgba(0,230,118,.06)', warn: 'rgba(255,171,64,.06)', bad: 'rgba(255,82,82,.06)', info: 'rgba(68,138,255,.06)' }
  const bdc = { good: 'rgba(0,230,118,.2)', warn: 'rgba(255,171,64,.2)', bad: 'rgba(255,82,82,.2)', info: 'rgba(68,138,255,.2)' }
  return <div>
    <div style={{ ...cs, borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <Gauge score={r.score} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[{ l: 'Diversif.', v: r.dS, m: 40 }, { l: 'Concentr.', v: r.cS, m: 30 }, { l: 'Momentum', v: r.mS, m: 30 }].map(x => { const rt = x.v / x.m; return <div key={x.l}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T2, marginBottom: 2 }}><span>{x.l}</span><span style={{ fontFamily: M }}>{x.v}/{x.m}</span></div><div style={{ height: 3, background: '#1e293b', borderRadius: 2 }}><div style={{ width: (rt * 100) + '%', height: '100%', borderRadius: 2, background: rt > .7 ? GRN : rt > .4 ? AMB : RED }} /></div></div> })}
        <div style={{ fontSize: 10, color: T3, textAlign: 'center', marginTop: 2 }}>Corr S&P: <span style={{ color: r.corrScore > .8 ? RED : r.corrScore > .6 ? AMB : GRN, fontFamily: M }}>{(r.corrScore * 100).toFixed(0)}%</span></div>
      </div>
    </div>
    <div style={{ ...cs, borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <h4 style={{ color: T1, margin: '0 0 10px', fontSize: 12, fontWeight: 600 }}>Recomendaciones ({r.recs.length})</h4>
      {!r.recs.length ? <div style={{ color: T3, textAlign: 'center', padding: 10, fontSize: 11 }}>Todo en orden ✓</div> :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {r.recs.map((rec, i) => <div key={i} style={{ background: bgc[rec.t], border: '1px solid ' + bdc[rec.t], borderRadius: 8, padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 13, flexShrink: 0 }}>{ic[rec.t]}</span>
            <div><div style={{ fontSize: 9, color: T3, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2, fontFamily: M }}>{rec.c}</div><div style={{ fontSize: 11, color: T2, lineHeight: 1.4 }}>{rec.x}</div></div>
          </div>)}
        </div>}
    </div>
    <div style={{ ...cs, borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h4 style={{ color: T1, margin: 0, fontSize: 12, fontWeight: 600 }}>📰 Noticias por acción</h4>
        <button onClick={loadCN} disabled={cnLoading} style={{ background: 'transparent', border: '1px solid rgba(68,138,255,.3)', borderRadius: 6, color: cnLoading ? T3 : BLU, padding: '4px 10px', fontSize: 10, cursor: cnLoading ? 'wait' : 'pointer', fontFamily: M }}>{cnLoading ? '...' : '⟳'}</button>
      </div>
      {compNews && compNews.length > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {compNews.map((c, i) => <div key={i} style={{ background: 'rgba(68,138,255,.04)', border: '1px solid rgba(68,138,255,.12)', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontFamily: M, fontSize: 11, fontWeight: 700, color: BLU, marginBottom: 6 }}>{c.ticker}</div>
          {c.news.map((n, j) => <div key={j} style={{ marginBottom: j < c.news.length - 1 ? 6 : 0 }}>
            {n.url ? <a href={n.url} target="_blank" rel="noopener" style={{ fontSize: 10, color: T1, fontWeight: 600, lineHeight: 1.3, display: 'block', textDecoration: 'none' }}>{n.headline}</a> : <div style={{ fontSize: 10, color: T1, fontWeight: 600, lineHeight: 1.3 }}>{n.headline}</div>}
            <div style={{ display: 'flex', gap: 6, fontSize: 9, color: T3, marginTop: 2, fontFamily: M }}>{n.source && <span>{n.source}</span>}{n.time && <span>· {n.time}</span>}</div>
          </div>)}
        </div>)}
      </div> : (!cnLoading && <div style={{ color: T3, textAlign: 'center', padding: 10, fontSize: 11 }}>Tocá ⟳</div>)}
    </div>
  </div>
}

/* ========== PERFORMANCE ========== */
function PP({ holdings, snaps, cfg }) {
  const tvRef = useRef(null)
  let tV = 0, tP = 0
  holdings.forEach(x => { const pa = x.current_price || null; tV += pa ? x.shares * pa : x.shares * x.avg_cost; tP += pa && x.type !== 'cash' ? (pa - x.avg_cost) * x.shares : 0 })
  const cap = tV - tP; const pnlPct = cap > 0 ? (tP / cap) * 100 : null

  useEffect(() => {
    if (!tvRef.current) return
    tvRef.current.innerHTML = ''
    const container = document.createElement('div')
    const widgetDiv = document.createElement('div')
    container.appendChild(widgetDiv)
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js'
    script.async = true
    script.textContent = JSON.stringify({ symbols: [['S&P 500', 'SPY|1D']], chartOnly: false, width: '100%', height: 400, locale: 'es', colorTheme: 'dark', autosize: false, showVolume: false, showMA: false, hideDateRanges: false, hideMarketStatus: false, hideSymbolLogo: false, scalePosition: 'right', scaleMode: 'Normal', fontFamily: M, fontSize: '10', noTimeScale: false, valuesTracking: '1', changeMode: 'percent-only', chartType: 'area', lineWidth: 2, lineColor: 'rgba(129,140,248,1)', topColor: 'rgba(129,140,248,0.15)', bottomColor: 'rgba(129,140,248,0.01)', backgroundColor: 'rgba(17,24,39,1)', gridLineColor: 'rgba(30,41,59,0.5)', dateRanges: ['1m|1D', '3m|1D', '6m|1D', '12m|1D', '60m|1W', 'all|1M'] })
    container.appendChild(script)
    tvRef.current.appendChild(container)
  }, [])

  const sorted = snaps.slice().sort((a, b) => a.date > b.date ? 1 : -1)

  return <div>
    {/* Evolution chart */}
    {sorted.length > 0 && <div style={{ ...cs, borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <h3 style={{ color: T1, margin: '0 0 4px', fontSize: 14, fontWeight: 600 }}>Evolución del rendimiento</h3>
      <div style={{ fontSize: 11, color: T3, marginBottom: 16, fontFamily: M }}>Snapshot diario al cierre · {sorted.length} {sorted.length === 1 ? 'día' : 'días'}</div>
      <LineChart data={sorted.map(s => ({ label: s.date.slice(5), full: s.date, rendimiento: s.rend_pct != null ? +Number(s.rend_pct).toFixed(2) : 0 }))} W={700} H={280} lines={[{ key: 'rendimiento', color: GRN, w: 2.5, area: true }]} zeroCenter={true} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: T3, fontFamily: M }}>
        <span>Inicio: {sorted[0]?.date || '—'}</span>
        <span>Último: {sorted[sorted.length - 1]?.date || '—'} → <span style={{ color: sorted[sorted.length - 1]?.rend_pct >= 0 ? GRN : RED }}>{sorted[sorted.length - 1] ? fp(sorted[sorted.length - 1].rend_pct) : '—'}</span></span>
      </div>
    </div>}
    {sorted.length === 0 && <div style={{ ...cs, borderRadius: 14, padding: 24, marginBottom: 20, textAlign: 'center', color: T3, fontSize: 11 }}>Tocá <strong style={{ color: T2 }}>⟳ Precios</strong> para generar el primer punto.</div>}

    {/* My return vs S&P */}
    <div style={{ ...cs, borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <h3 style={{ color: T1, margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Mi cartera vs S&P 500</h3>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 200px', textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 11, color: T3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontFamily: M }}>Mi rendimiento</div>
          <div style={{ fontSize: 42, fontWeight: 700, fontFamily: M, color: pnlPct != null && pnlPct >= 0 ? GRN : RED }}>{pnlPct != null ? fp(pnlPct) : '—'}</div>
        </div>
        <div style={{ fontSize: 28, color: T3, fontWeight: 300 }}>vs</div>
        <div style={{ flex: '1 1 200px', textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 11, color: T3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontFamily: M }}>S&P 500</div>
          <div style={{ fontSize: 18, color: PUR, fontFamily: M }}>Ver gráfico abajo ↓</div>
        </div>
      </div>
    </div>

    {/* TradingView */}
    <div style={{ ...cs, borderRadius: 14, padding: 20, overflow: 'hidden' }}>
      <h3 style={{ color: T1, margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>S&P 500 (SPY) — Tiempo real</h3>
      <div ref={tvRef} style={{ width: '100%', minHeight: 400, borderRadius: 8, overflow: 'hidden' }}></div>
    </div>
  </div>
}

/* ========== CONFIG PANEL ========== */
function ConfigPanel({ cfg, onCfg }) {
  const ci = { background: '#0f172a', border: '1px solid ' + BDR, borderRadius: 8, padding: '10px 12px', color: T1, fontSize: 13, outline: 'none', fontFamily: M, boxSizing: 'border-box' }
  return <div>
    <div style={{ ...cs, borderRadius: 14, padding: 24, marginBottom: 20 }}>
      <h3 style={{ color: T1, margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>🔑 API Keys</h3>
      <div style={{ maxWidth: 500 }}>
        <div style={{ marginBottom: 16 }}><label style={ls}>Finnhub API Key</label><input style={{ ...ci, width: '100%' }} type="password" placeholder="Tu key gratuita de finnhub.io" value={cfg.finnhub_key || ''} onChange={e => onCfg({ ...cfg, finnhub_key: e.target.value.trim() })} /></div>
        <div style={{ marginBottom: 16 }}><label style={ls}>Anthropic API Key (opcional, para Moody's)</label><input style={{ ...ci, width: '100%' }} type="password" placeholder="sk-ant-..." value={cfg.anthropic_key || ''} onChange={e => onCfg({ ...cfg, anthropic_key: e.target.value.trim() })} /></div>
      </div>
    </div>
    <div style={{ ...cs, borderRadius: 14, padding: 24 }}>
      <h3 style={{ color: T1, margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>📊 Criterios de análisis</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center', maxWidth: 400 }}>
        <span style={{ fontSize: 13, color: T2 }}>Máx. peso por sector</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input style={{ ...ci, width: 70, textAlign: 'center' }} type="number" value={cfg.max_sector_pct} onChange={e => onCfg({ ...cfg, max_sector_pct: +e.target.value || 30 })} /><span style={{ color: T3, fontSize: 12 }}>%</span></div>
        <span style={{ fontSize: 13, color: T2 }}>Máx. peso por posición</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input style={{ ...ci, width: 70, textAlign: 'center' }} type="number" value={cfg.max_pos_pct} onChange={e => onCfg({ ...cfg, max_pos_pct: +e.target.value || 20 })} /><span style={{ color: T3, fontSize: 12 }}>%</span></div>
        <span style={{ fontSize: 13, color: T2 }}>Mín. sectores</span>
        <input style={{ ...ci, width: 70, textAlign: 'center' }} type="number" value={cfg.min_sectors} onChange={e => onCfg({ ...cfg, min_sectors: +e.target.value || 3 })} />
        <span style={{ fontSize: 13, color: T2 }}>Alerta momentum</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input style={{ ...ci, width: 70, textAlign: 'center' }} type="number" value={cfg.momentum_warn_pct} onChange={e => onCfg({ ...cfg, momentum_warn_pct: +e.target.value || -10 })} /><span style={{ color: T3, fontSize: 12 }}>%</span></div>
      </div>
    </div>
  </div>
}

function Dashboard({ user }) {
  const { holdings: h, snapshots: snaps, config: cfg, loading, fetching, lastUpdate: lastUpd, msg, addHolding: addH, deleteHolding: delH, editHolding: editH, fetchAllPrices: fetchAll, saveConfig: sCfg } = usePortfolio(user)
  const [tab, setTab] = useState('portfolio')
  const [showAdd, sSA] = useState(false)

  const wp = h.filter(x => x.current_price)
  const tabs = [{ k: 'portfolio', l: 'Posiciones' }, { k: 'performance', l: 'Rendimiento' }, { k: 'config', l: '⚙️ Config' }]

  // Auto-refresh every 1 hour
  useEffect(() => {
    if (!cfg.finnhub_key || !h.length) return
    const timer = setInterval(() => fetchAll(), 3600000)
    return () => clearInterval(timer)
  }, [cfg.finnhub_key, h.length, fetchAll])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: DBG, color: T3 }}>Cargando portafolio...</div>

  return <div style={{ minHeight: '100vh', background: DBG }}>
    <div style={{ background: CBG, borderBottom: '1px solid ' + BDR, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
      <div><div style={{ fontSize: 17, fontWeight: 700 }}>Mi Portafolio</div><div style={{ fontSize: 11, color: T3, fontFamily: M }}>{lastUpd ? 'Últ: ' + lastUpd : 'manual'}{cfg.finnhub_key && h.length > 0 ? ' · Auto 1h' : ''}</div></div>
      <div style={{ display: 'flex', gap: 6 }}>
        {tabs.map(t => <button key={t.k} onClick={() => setTab(t.k)} style={{ background: tab === t.k ? '#1e293b' : 'transparent', color: tab === t.k ? T1 : T3, border: '1px solid ' + (tab === t.k ? BDR : 'transparent'), borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: M, fontWeight: 600 }}>{t.l}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={fetchAll} disabled={fetching || !h.length} style={{ background: 'transparent', border: '1px solid ' + BDR, borderRadius: 8, color: fetching ? T3 : T2, padding: '8px 14px', fontSize: 12, cursor: fetching ? 'wait' : 'pointer', fontFamily: M }}>{fetching ? 'Cargando...' : '⟳ Precios'}</button>
        <button onClick={() => sSA(true)} style={{ background: GRN, color: DBG, border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: M }}>+ Agregar</button>
        <button onClick={() => supabase.auth.signOut()} style={{ background: 'transparent', border: '1px solid rgba(255,82,82,.3)', borderRadius: 8, color: RED, padding: '8px 12px', fontSize: 11, cursor: 'pointer', fontFamily: M }}>Salir</button>
      </div>
    </div>
    {msg && <div style={{ padding: '10px 24px', background: msg.t === 'g' ? 'rgba(0,230,118,.1)' : msg.t === 'w' ? 'rgba(255,171,64,.1)' : 'rgba(255,82,82,.1)', borderBottom: '1px solid ' + BDR, fontSize: 13, color: msg.t === 'g' ? GRN : msg.t === 'w' ? AMB : RED, fontFamily: M }}>{msg.m}</div>}
    <div style={{ padding: '20px 24px', maxWidth: 1800, margin: '0 auto' }}>
      {showAdd && <AddForm onAdd={x => { addH(x); sSA(false) }} onCancel={() => sSA(false)} />}
      {tab === 'portfolio' && <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 280px', position: 'sticky', top: 20, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
          <MarketNews cfg={cfg} />
        </div>
        <div style={{ flex: '1 1 500px', minWidth: 0, overflow: 'hidden' }}>
          <HT h={h} onD={delH} onEdit={editH} />
          {wp.length > 0 && <div style={{ marginTop: 20 }}><WP h={h} /></div>}
          <div style={{ marginTop: 20 }}><TxHist h={h} /></div>
        </div>
        <div style={{ flex: '0 0 260px', position: 'sticky', top: 20, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
          <RP h={h} cfg={cfg} />
        </div>
      </div>}
      {tab === 'performance' && <PP holdings={h} snaps={snaps} cfg={cfg} />}
      {tab === 'config' && <ConfigPanel cfg={cfg} onCfg={sCfg} />}
      <div style={{ marginTop: 32, padding: '16px 0', borderTop: '1px solid ' + BDR, fontSize: 11, color: T3, fontFamily: M, textAlign: 'center' }}>
        Privado · {Object.keys(CD).length}+ CEDEARs · Finnhub · {user.email} · <span style={{ cursor: 'pointer', color: BLU }} onClick={() => supabase.auth.signOut()}>Cerrar sesión</span>
      </div>
    </div>
  </div>
}
