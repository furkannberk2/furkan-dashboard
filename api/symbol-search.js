import axios from 'axios'

const KEY = process.env.TWELVE_DATA_KEY

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { q, type } = req.query
  if (!q) return res.status(400).json({ error: 'q gerekli' })

  try {
    const r = await axios.get('https://api.twelvedata.com/symbol_search', {
      params: { symbol: q, outputsize: 50, apikey: KEY }
    })
    let all = (r.data.data || []).map(d => ({
      symbol: d.symbol,
      instrument_name: d.instrument_name,
      instrument_type: d.instrument_type || '',
      exchange: d.exchange || d.country || ''
    }))

    // Türe göre filtrele
    if (type === 'crypto') {
      all = all.filter(d => /crypto|digital/i.test(d.instrument_type))
    } else if (type === 'forex') {
      all = all.filter(d => /currency|forex/i.test(d.instrument_type))
    } else {
      all = all.filter(d => /stock|equity|common|etf|fund|index/i.test(d.instrument_type) || !d.instrument_type)
    }

    res.status(200).json({ results: all.slice(0, 15) })
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message })
  }
}