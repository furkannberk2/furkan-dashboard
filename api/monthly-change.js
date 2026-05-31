import axios from 'axios'

const KEY = process.env.TWELVE_DATA_KEY

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { symbols } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols gerekli' })

  const list = symbols.split(',').map(s => s.trim()).filter(Boolean)
  const out = {}

  await Promise.all(list.map(async sym => {
    try {
      const r = await axios.get('https://api.twelvedata.com/time_series', {
        params: { symbol: sym, interval: '1day', outputsize: 30, apikey: KEY }
      })
      const values = r.data.values || []
      if (values.length >= 2) {
        const latest = parseFloat(values[0].close)
        const oldest = parseFloat(values[values.length - 1].close)
        const change = ((latest - oldest) / oldest) * 100
        out[sym] = { monthly_change: change.toFixed(2) }
      } else {
        out[sym] = { monthly_change: null }
      }
    } catch {
      out[sym] = { monthly_change: null }
    }
  }))

  res.status(200).json(out)
}