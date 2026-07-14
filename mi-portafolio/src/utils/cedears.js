// CEDEAR ratios from Comafi/BYMA
export const CD = {"AAPL":20,"MSFT":15,"GOOGL":22,"AMZN":36,"META":10,"TSLA":15,"NVDA":20,"JPM":5,"V":8,"WMT":10,"JNJ":4,"PG":6,"UNH":2,"HD":3,"MA":4,"DIS":6,"BAC":14,"XOM":5,"KO":10,"PFE":25,"PEP":5,"CSCO":14,"ABBV":6,"AVGO":4,"CRM":4,"COST":2,"TMO":2,"MCD":3,"ACN":3,"ABT":6,"NKE":6,"DHR":4,"LIN":3,"QCOM":8,"TXN":8,"MDT":6,"AMGN":3,"UNP":3,"NEE":12,"HON":4,"PM":5,"BMY":10,"CAT":3,"CVX":3,"UPS":4,"DE":2,"LMT":2,"GS":2,"BLK":1,"AXP":4,"SYK":2,"ISRG":2,"GILD":8,"MDLZ":10,"ADI":5,"CI":2,"CME":2,"CB":3,"MMC":3,"SO":8,"DUK":6,"CL":6,"ICE":4,"AON":2,"REGN":1,"BDX":3,"ITW":3,"SHW":2,"APD":3,"EQIX":1,"MO":12,"HUM":1,"ADSK":3,"MELI":2,"BABA":10,"NIO":25,"VALE":20,"BBD":20,"GOLD":10,"SID":14,"ERJ":4,"ITUB":10,"PBR":10,"VIST":3,"GLOB":4,"BIOX":4,"DESP":5,"CAAP":6,"SUPV":6,"LOMA":6,"BMA":4,"GGAL":10,"YPF":5,"TEO":5,"TGS":5,"ARCO":3,"CRESY":5,"IRS":10,"BBAR":6,"EDN":20,"PAM":5,"TX":5,"TS":3,"CEPU":10,"MSBF":6}
export const CEDEAR_NAMES = {"AAPL":"Apple","MSFT":"Microsoft","GOOGL":"Alphabet","AMZN":"Amazon","META":"Meta","TSLA":"Tesla","NVDA":"Nvidia","JPM":"JP Morgan","V":"Visa","WMT":"Walmart","JNJ":"Johnson & Johnson","PG":"Procter & Gamble","UNH":"UnitedHealth","HD":"Home Depot","MA":"Mastercard","DIS":"Disney","BAC":"Bank of America","XOM":"Exxon Mobil","KO":"Coca-Cola","PFE":"Pfizer","MELI":"MercadoLibre","BABA":"Alibaba","VALE":"Vale","GLOB":"Globant","GGAL":"Grupo Galicia","YPF":"YPF","VIST":"Vista Energy","BMA":"Banco Macro"}

export function lookupCedear(ticker) {
  if (!ticker) return { found: false }
  var t = ticker.toUpperCase().trim()
  if (CD[t]) return { found: true, ratio: CD[t], us: t }
  // Try removing .BA suffix
  var clean = t.replace(/\.BA$/, '')
  if (CD[clean]) return { found: true, ratio: CD[clean], us: clean }
  return { found: false }
}
