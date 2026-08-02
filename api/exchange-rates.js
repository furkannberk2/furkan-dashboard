import axios from 'axios'

// USD baz alınarak çekilen kurlar. Baz-bağımsız kullanım için:
// 1 USD = rates[X] birim X. Kullanıcının ana para birimi ne olursa olsun,
// USD-pivot mantığıyla (utils/finance.js) dönüşüm yapılır.
const TARGET_CURRENCIES = [
  'TRY', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD',
  'INR', 'CNY', 'RUB', 'AED', 'SAR', 'SEK', 'NOK', 'DKK',
  'PLN', 'MXN', 'BRL', 'ZAR', 'HKD', 'SGD', 'KRW'
]

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const to = TARGET_CURRENCIES.join(',')
    const r = await axios.get(`https://api.frankfurter.app/latest?from=USD&to=${to}`)
    const data = r.data
    // data.rates: { TRY: 32.5, EUR: 0.92, ... }  (1 USD = X birim)
    res.status(200).json({
      base: 'USD',
      usdTry: data.rates.TRY, // geriye uyumluluk (eski kod bunu kullanıyordu)
      rates: data.rates,
      date: data.date
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}