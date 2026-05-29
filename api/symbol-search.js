import axios from 'axios'

const KEY = process.env.TWELVE_DATA_KEY

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { q, type } = req.query
  if (!q) return res.status(400).json({ error: 'q gerekli' })

  try {
    let results = []

    if (type === 'crypto') {
      const r = await axios.get('https://api.twelvedata.com/cryptocurrencies', { params: { symbol: q, apikey: KEY } })
      results = (r.data.data || []).map(d => ({
        symbol: d.symbol,
        instrument_name: d.currency_base + ' / ' + d.currency_quote,
        instrument_type: 'Kripto',
        exchange: d.available_exchanges?.[0] || ''
      }))
    } else if (type === 'forex') {
      const r = await axios.get('https://api.twelvedata.com/forex_pairs', { params: { symbol: q, apikey: KEY } })
      results = (r.data.data || []).map(d => ({
        symbol: d.symbol,
        instrument_name: d.currency_base + ' / ' + d.currency_quote,
        instrument_type: 'Döviz',
        exchange: ''
      }))
    } else {
      // Hisse ve diğerleri için genel arama
      const r = await axios.get('https://api.twelvedata.com/symbol_search', { params: { symbol: q, outputsize: 15, apikey: KEY } })
      results = (r.data.data || []).map(d => ({
        symbol: d.symbol,
        instrument_name: d.instrument_name,
        instrument_type: d.instrument_type || 'Hisse',
        exchange: d.exchange || d.country || ''
      }))
    }

    res.status(200).json({ results })
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message })
  }
}