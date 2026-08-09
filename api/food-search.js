import axios from 'axios'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { q } = req.query
  if (!q) return res.status(400).json({ error: 'q gerekli' })

  try {
    const r = await axios.get('https://world.openfoodfacts.org/cgi/search.pl', {
      params: {
        search_terms: q,
        search_simple: 1,
        action: 'process',
        json: 1,
        page_size: 40,
        // Popülerliğe göre sırala (daha alakalı/bilinen ürünler öne)
        sort_by: 'unique_scans_n',
        lc: 'tr',
        fields: 'product_name,product_name_tr,brands,nutriments,code'
      },
      headers: {
        'User-Agent': 'FurkanDashboard/1.0 (personal use)'
      },
      timeout: 10000
    })

    const list = r.data.products || []
    const products = list
      // İsmi olan her ürünü al (kalorisi olmayanı da göster, sadece 0 yazılır)
      .filter(p => (p.product_name_tr || p.product_name))
      .map(p => ({
        name: p.product_name_tr || p.product_name || 'İsimsiz',
        brand: p.brands || '',
        calories: Math.round(p.nutriments?.['energy-kcal_100g'] || 0),
        protein: Math.round((p.nutriments?.['proteins_100g'] || 0) * 10) / 10,
        carbs: Math.round((p.nutriments?.['carbohydrates_100g'] || 0) * 10) / 10,
        fat: Math.round((p.nutriments?.['fat_100g'] || 0) * 10) / 10
      }))
      // Kalorisi olanları öne al (0 olanlar sona)
      .sort((a, b) => (b.calories > 0 ? 1 : 0) - (a.calories > 0 ? 1 : 0))
      .slice(0, 25)

    res.status(200).json({ products })
  } catch (err) {
    res.status(500).json({ error: err.response?.status ? `Status ${err.response.status}` : err.message })
  }
}