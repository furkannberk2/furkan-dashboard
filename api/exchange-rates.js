import axios from 'axios'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    // Frankfurter API, anahtarsız, sınırsız, ECB verisi
    // USD baz alarak TRY, EUR, GBP çekelim
    const r = await axios.get('https://api.frankfurter.app/latest?from=USD&to=TRY,EUR,GBP')
    const data = r.data
    // Format: { amount: 1, base: 'USD', date: '...', rates: { TRY: 32.5, EUR: 0.92, GBP: 0.78 } }
    res.status(200).json({ usdTry: data.rates.TRY, rates: data.rates })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}