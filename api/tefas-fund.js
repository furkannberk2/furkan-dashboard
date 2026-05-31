import axios from 'axios'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { codes } = req.query
  if (!codes) return res.status(400).json({ error: 'codes gerekli' })

  const list = codes.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  const out = {}

  const today = new Date()
  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 35)

  function formatDate(d) {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}.${mm}.${d.getFullYear()}`
  }

  for (const code of list) {
    try {
      const params = new URLSearchParams({
        fontip: 'YAT',
        sfontur: '',
        fonkod: code,
        fongrup: '',
        bastarih: formatDate(monthAgo),
        bittarih: formatDate(today),
        fonturkod: '',
        fonunvantip: ''
      })
      const r = await axios.post(
        'https://www.tefas.gov.tr/api/DB/BindHistoryInfo',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'tr-TR,tr;q=0.9',
            'Referer': 'https://www.tefas.gov.tr/TarihselVeriler.aspx',
            'Origin': 'https://www.tefas.gov.tr',
            'X-Requested-With': 'XMLHttpRequest'
          }
        }
      )
      const data = r.data?.data || []
      if (data.length === 0) {
        out[code] = { close: 0, error: 'not_found' }
        continue
      }
      const sorted = data.sort((a, b) => b.TARIH - a.TARIH)
      const latest = sorted[0]
      const oldest = sorted[sorted.length - 1]
      const dayBefore = sorted[1] || oldest

      const latestPrice = parseFloat(latest.FIYAT)
      const dayBeforePrice = parseFloat(dayBefore.FIYAT)
      const oldestPrice = parseFloat(oldest.FIYAT)

      const dailyChange = ((latestPrice - dayBeforePrice) / dayBeforePrice) * 100
      const monthlyChange = ((latestPrice - oldestPrice) / oldestPrice) * 100

      out[code] = {
        close: latestPrice,
        previous_close: dayBeforePrice,
        percent_change: dailyChange,
        monthly_change: monthlyChange.toFixed(2),
        currency: 'TRY',
        name: latest.FONUNVAN || code
      }
    } catch (err) {
      out[code] = { close: 0, error: err.response?.status ? `HTTP ${err.response.status}` : err.message }
    }
  }

  res.status(200).json(out)
}