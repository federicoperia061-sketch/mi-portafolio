// Finnhub API calls
export async function fetchFinnhub(symbol, apiKey) {
  if (!apiKey) return null
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json()
    if (data && data.c && data.c > 0) return { price: data.c, dp: data.dp || 0 }
  } catch (e) { }
  return null
}

export async function fetchStockPrice(ticker, type, cedearRatio, cedearUS, apiKey) {
  if (type === 'cash') return { price: 1, dp: 0 }
  if (type === 'crypto') {
    const cgMap = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', ADA: 'cardano', DOT: 'polkadot', AVAX: 'avalanche-2', LINK: 'chainlink', DOGE: 'dogecoin', XRP: 'ripple', LTC: 'litecoin' }
    const cgId = cgMap[ticker.toUpperCase()] || ticker.toLowerCase()
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd&include_24hr_change=true`, { signal: AbortSignal.timeout(8000) })
      const data = await res.json()
      if (data[cgId] && data[cgId].usd) return { price: data[cgId].usd, dp: data[cgId].usd_24h_change || 0 }
    } catch (e) { }
    return null
  }
  if (!apiKey) return null
  if (type === 'cedear') {
    const usTicker = cedearUS || ticker
    const q = await fetchFinnhub(usTicker, apiKey)
    if (q && cedearRatio && cedearRatio > 0) return { price: q.price / cedearRatio, dp: q.dp }
    return null
  }
  return await fetchFinnhub(ticker, apiKey)
}

export async function fetchCandles(symbol, fromDate, toDate, apiKey) {
  if (!apiKey) return []
  try {
    const from = Math.floor(new Date(fromDate).getTime() / 1000)
    const to = Math.floor(new Date(toDate).getTime() / 1000) + 86400
    const res = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data = await res.json()
    if (data.s !== 'ok' || !data.c || !data.t) return []
    return data.t.map((t, i) => ({ date: new Date(t * 1000).toISOString().split('T')[0], close: data.c[i] }))
  } catch (e) { return [] }
}

export async function fetchGeneralNews(apiKey) {
  if (!apiKey) return []
  try {
    const res = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data = await res.json()
    return (data || []).slice(0, 12).map(n => {
      let cat = 'mercados'
      const hl = (n.headline || '').toLowerCase()
      if (/oil|gold|silver|copper|commodity|crude|wheat/.test(hl)) cat = 'commodities'
      else if (/fed|rate|inflation|gdp|treasury|central bank|cpi/.test(hl)) cat = 'macro'
      else if (/war|sanction|tariff|china|russia|ukraine|trump/.test(hl)) cat = 'geopolítica'
      else if (/bitcoin|crypto|ethereum|btc|eth/.test(hl)) cat = 'cripto'
      const dt = n.datetime ? new Date(n.datetime * 1000) : null
      let ago = ''
      if (dt) { const mins = Math.round((Date.now() - dt.getTime()) / 60000); ago = mins < 60 ? mins + 'm' : mins < 1440 ? Math.round(mins / 60) + 'h' : Math.round(mins / 1440) + 'd' }
      return { headline: n.headline || '', summary: n.summary || '', source: n.source || '', url: n.url || '', category: cat, time: ago }
    })
  } catch (e) { return [] }
}

export async function fetchPriceTarget(ticker, apiKey) {
  if (!apiKey || !ticker) return null
  try {
    const res = await fetch(`https://finnhub.io/api/v1/stock/price-target?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json()
    if (!data || !data.targetMean) return null
    return {
      targetHigh: data.targetHigh,
      targetLow: data.targetLow,
      targetMean: data.targetMean,
      targetMedian: data.targetMedian,
      lastUpdated: data.lastUpdated
    }
  } catch (e) { return null }
}

export async function fetchRecommendationTrends(ticker, apiKey) {
  if (!apiKey || !ticker) return null
  try {
    const res = await fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json()
    if (!data || !data.length) return null
    // Most recent period first
    const latest = data[0]
    const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell
    return {
      period: latest.period,
      strongBuy: latest.strongBuy,
      buy: latest.buy,
      hold: latest.hold,
      sell: latest.sell,
      strongSell: latest.strongSell,
      total,
      bullishPct: total > 0 ? ((latest.strongBuy + latest.buy) / total) * 100 : 0
    }
  } catch (e) { return null }
}

export async function fetchAnalystData(ticker, apiKey) {
  const [target, recs] = await Promise.all([
    fetchPriceTarget(ticker, apiKey),
    fetchRecommendationTrends(ticker, apiKey)
  ])
  return { target, recs }
}

export async function fetchCompanyNews(ticker, apiKey) {
  if (!apiKey || !ticker) return []
  try {
    const to = new Date().toISOString().split('T')[0]
    const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const res = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&token=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data = await res.json()
    return (data || []).slice(0, 5).map(n => {
      const dt = n.datetime ? new Date(n.datetime * 1000) : null
      let ago = ''
      if (dt) { const mins = Math.round((Date.now() - dt.getTime()) / 60000); ago = mins < 60 ? mins + 'm' : mins < 1440 ? Math.round(mins / 60) + 'h' : Math.round(mins / 1440) + 'd' }
      return { headline: n.headline || '', summary: n.summary || '', source: n.source || '', url: n.url || '', time: ago }
    })
  } catch (e) { return [] }
}
