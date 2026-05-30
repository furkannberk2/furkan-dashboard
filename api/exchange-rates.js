import axios from 'axios'

const KEY = process.env.EXCHANGE_RATE_KEY

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    // USD bazlı tüm kurları çek
    const r = await axios.get(`https://v6.exchangerate-api.com/v6/${KEY}/latest/USD`)
    const rates = r.data.conversion_rates
    res.status(200).json({ usdTry: rates.TRY, rates })
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.['error-type'] || err.message })
  }
}