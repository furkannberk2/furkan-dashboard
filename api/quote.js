import yahooFinance from 'yahoo-finance2'

// Twelve Data sembol → Yahoo sembol dönüşümü
function toYahooSymbol(sym, hint = '') {
  // hint: "BIST" gelirse .IS eklenir
  if (!sym) return sym
  // Kripto: BTC/USD → BTC-USD
  if (sym.includes('/')) return sym.replace('/', '-')
  // BIST hint
  if (hint === 'BIST' && !sym.includes('.')) return sym + '.IS'
  // XAU/XAG için özel
  return sym
}

function fromYahooSymbol(yahooSym) {
  // Yahoo formatından geri çevir
  if (yahooSym.endsWith('.IS')) return yahooSym.slice(0, -3)
  if (yahooSym.endsWith('-USD') || yahooSym.endsWith('-EUR') || yahooSym.endsWith('-CAD')) {
    return yahooSym.replace('-', '/')
  }
  return yahooSym
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { symbols, hints } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols gerekli' })

  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean)
  // hints: BIST sembolleri için (örn. "THYAO,ASELS" → BIST flag'iyle gelir)
  const hintList = (hints || '').split(',').map(s => s.trim())

  // Twelve Data formatından Yahoo formatına dönüştür
  const yahooSymbols = symbolList.map((s, i) => toYahooSymbol(s, hintList[i] || ''))

  try {
    // Yahoo Finance'tan tek seferde tüm semboller (paralel)
    const results = await Promise.allSettled(
      yahooSymbols.map(s => yahooFinance.quote(s, { validateResult: false }))
    )

    const out = {}
    results.forEach((r, i) => {
      const originalSym = symbolList[i]
      if (r.status === 'fulfilled' && r.value) {
        const q = r.value
        out[originalSym] = {
          close: q.regularMarketPrice,
          previous_close: q.regularMarketPreviousClose,
          percent_change: q.regularMarketChangePercent,
          currency: q.currency,
          name: q.longName || q.shortName || originalSym
        }
      } else {
        out[originalSym] = { close: 0, percent_change: 0, error: 'not_found' }
      }
    })

    res.status(200).json(out)
  } catch (err) {
    res.status(200).json({})
  }
}