import axios from 'axios'

const KEY = process.env.TWELVE_DATA_KEY

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { symbols } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols gerekli' })

  try {
    const response = await axios.get('https://api.twelvedata.com/quote', {
      params: { symbol: symbols, apikey: KEY }
    })
    const data = response.data

    // API kod hatası (örn. rate limit) — boş dön
    if (data.code && data.code >= 400) {
      return res.status(200).json({})
    }

    let result = {}
    if (data.symbol) {
      result[data.symbol] = data
    } else {
      result = data
    }
    res.status(200).json(result)
  } catch (err) {
    // Rate limit veya başka hata — boş dön ki frontend takılmasın
    res.status(200).json({})
  }
}