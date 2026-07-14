export const fu = v => v == null ? '—' : '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fp = v => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
export const gid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9)

export const AT = [
  { value: 'stock_us', label: 'Acción US' },
  { value: 'cedear', label: 'Cedear' },
  { value: 'etf', label: 'ETF' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'cash', label: 'Cash' }
]

export const SECTORS = ['Tecnología', 'Finanzas', 'Salud', 'Energía', 'Consumo Discrecional', 'Consumo Básico', 'Industria', 'Materiales', 'Real Estate', 'Comunicaciones', 'Utilities', 'Crypto', 'Otro']

// Theme
export const DBG = '#0a0f1a', CBG = '#0f172a', BDR = '#1e293b'
export const T1 = '#e2e8f0', T2 = '#94a3b8', T3 = '#64748b'
export const GRN = '#00e676', RED = '#ff5252', BLU = '#448aff', AMB = '#ffab40', PUR = '#818cf8'
export const M = "'JetBrains Mono', monospace"
export const PAL = ['#818cf8', '#00e676', '#ff5252', '#ffab40', '#448aff', '#e040fb', '#00bcd4', '#ff6d00', '#69f0ae', '#7c4dff', '#ffd740', '#ff4081']
export const cs = { background: CBG, border: '1px solid ' + BDR }
export const ls = { display: 'block', fontSize: 11, color: T3, marginBottom: 4, fontFamily: M }
export const is = { background: '#0f172a', border: '1px solid ' + BDR, borderRadius: 8, padding: '10px 12px', color: T1, fontSize: 14, outline: 'none', fontFamily: M, width: '100%', boxSizing: 'border-box' }
