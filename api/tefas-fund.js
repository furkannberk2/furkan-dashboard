import axios from 'axios'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { codes } = req.query
  if (!codes) return res.status(400).json({ error: 'codes gerekli' })

  const list = codes.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  const out = {}

  for (const code of list) {
    try {
      const r = await axios.post(
        'https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir',
        { fonKodu: code, dil: 'TR', periyod: 12 },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Origin': 'https://www.tefas.gov.tr',
            'Referer': `https://www.tefas.gov.tr/tr/fon-detayli-analiz/${code}`
          }
        }
      )
      const list2 = r.data?.resultList || []
      if (list2.length === 0) {
        out[code] = { close: 0, error: 'not_found' }
        continue
      }

      // Son tarihe göre sırala (büyükten küçüğe)
      const sorted = [...list2].sort((a, b) => new Date(b.tarih) - new Date(a.tarih))
      const latest = sorted[0]
      const dayBefore = sorted[1] || latest

      // 30 gün öncesi bul
      const latestDate = new Date(latest.tarih)
      const monthAgo = new Date(latestDate)
      monthAgo.setDate(monthAgo.getDate() - 30)
      const monthAgoEntry = sorted.find(e => new Date(e.tarih) <= monthAgo) || sorted[sorted.length - 1]

      const latestPrice = parseFloat(latest.fiyat)
      const dayBeforePrice = parseFloat(dayBefore.fiyat)
      const monthAgoPrice = parseFloat(monthAgoEntry.fiyat)

      out[code] = {
        close: latestPrice,
        previous_close: dayBeforePrice,
        percent_change: ((latestPrice - dayBeforePrice) / dayBeforePrice) * 100,
        monthly_change: ((latestPrice - monthAgoPrice) / monthAgoPrice) * 100,
        currency: 'TRY',
        name: latest.fonUnvan || code,
        date: latest.tarih
      }
    } catch (err) {
      out[code] = { close: 0, error: err.response?.status ? `HTTP ${err.response.status}` : err.message }
    }
  }

  res.status(200).json(out)
}