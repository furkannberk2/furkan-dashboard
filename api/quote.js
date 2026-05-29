import axios from 'axios'

const KEY = process.env.TWELVE_DATA_KEY

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { symbols } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols gerekli' })

  try {
    // Birden fazla sembol virgülle: AAPL,BTC/USD,EUR/USD
    const response = await axios.get('https://api.twelvedata.com/quote', {
      params: { symbol: symbols, apikey: KEY }
    })

    const data = response.data
    // Tek sembolde düz obje, çoklu sembolde { SYM: {...} } döner — normalize et
    let result = {}
    if (data.symbol) {
      result[data.symbol] = data
    } else {
      result = data
    }

    res.status(200).json(result)
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message })
  }
}