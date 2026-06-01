import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()

function toYahooSymbol(sym, hint = '') {
  if (!sym) return sym
  // Altın
  if (sym === 'XAU/USD' || sym === 'XAUUSD') return 'GC=F'
  // Gümüş
  if (sym === 'XAG/USD' || sym === 'XAGUSD') return 'SI=F'
  // Kripto: BTC/USD → BTC-USD
  if (sym.includes('/')) return sym.replace('/', '-')
  // BIST
  if (hint === 'BIST' && !sym.includes('.')) return sym + '.IS'
  return sym
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { symbols, hints } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols gerekli' })

  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean)
  const hintList = (hints || '').split(',').map(s => s.trim())
  const yahooSymbols = symbolList.map((s, i) => toYahooSymbol(s, hintList[i] || ''))

  const out = {}

  for (let i = 0; i < symbolList.length; i++) {
    const originalSym = symbolList[i]
    const ySym = yahooSymbols[i]
    try {
      const q = await yahooFinance.quote(ySym)
      out[originalSym] = {
        close: q.regularMarketPrice ?? 0,
        previous_close: q.regularMarketPreviousClose ?? 0,
        percent_change: q.regularMarketChangePercent ?? 0,
        currency: q.currency || 'USD',
        name: q.longName || q.shortName || originalSym
      }
    } catch (err) {
      out[originalSym] = { close: 0, percent_change: 0, error: err.message }
    }
  }

  res.status(200).json(out)
}