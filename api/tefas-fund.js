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
      const data = r.data
      // Veri yapısı henüz belirsiz, ne dönerse out'a koy
      out[code] = data
    } catch (err) {
      out[code] = { error: err.response?.status ? `HTTP ${err.response.status}` : err.message }
    }
  }

  res.status(200).json(out)
}