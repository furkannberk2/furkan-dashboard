import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { q, type } = req.query
  if (!q) return res.status(400).json({ error: 'q gerekli' })

  try {
    const result = await yahooFinance.search(q, {
      quotesCount: 20,
      newsCount: 0
    })

    let quotes = result.quotes || []

    // Türe göre filtre
    if (type === 'crypto') {
      quotes = quotes.filter(q => q.quoteType === 'CRYPTOCURRENCY')
    } else if (type === 'forex') {
      quotes = quotes.filter(q => q.quoteType === 'CURRENCY')
    } else if (type === 'bist') {
      quotes = quotes.filter(q => q.exchange === 'IST' || q.symbol?.endsWith('.IS'))
    } else {
      // ABD hisse — BIST hariç
      quotes = quotes.filter(q =>
        (q.quoteType === 'EQUITY' || q.quoteType === 'ETF') &&
        !q.symbol?.endsWith('.IS')
      )
    }

    // Çıktı formatı (eski uyumlu)
    const results = quotes.map(q => {
      // BIST sembolü .IS olmadan döndür (frontend'in beklediği format)
      let symbol = q.symbol
      if (symbol?.endsWith('.IS')) symbol = symbol.slice(0, -3)
      // Kripto sembol BTC-USD → BTC/USD
      if (q.quoteType === 'CRYPTOCURRENCY' && symbol?.includes('-')) {
        symbol = symbol.replace('-', '/')
      }
      return {
        symbol,
        instrument_name: q.longname || q.shortname || q.symbol,
        instrument_type: q.quoteType === 'CRYPTOCURRENCY' ? 'Digital Currency' :
                         q.quoteType === 'CURRENCY' ? 'Physical Currency' :
                         q.quoteType === 'ETF' ? 'ETF' : 'Common Stock',
        exchange: q.exchange === 'IST' ? 'BIST' : (q.exchange || '')
      }
    })

    res.status(200).json({ results: results.slice(0, 15) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}