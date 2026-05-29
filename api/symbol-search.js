import axios from 'axios'

const KEY = process.env.TWELVE_DATA_KEY

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { q } = req.query
  if (!q) return res.status(400).json({ error: 'q gerekli' })

  try {
    const response = await axios.get('https://api.twelvedata.com/symbol_search', {
      params: { symbol: q, outputsize: 15, apikey: KEY }
    })
    res.status(200).json({ results: response.data.data || [] })
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message })
  }
}