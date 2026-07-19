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
        page_size: 20,
        fields: 'product_name,product_name_tr,brands,nutriments,code'
      },
      headers: {
        'User-Agent': 'FurkanDashboard/1.0 (personal use)'
      },
      timeout: 10000
    })

    const list = r.data.products || []
    const products = list
      .filter(p => p.nutriments?.['energy-kcal_100g'])
      .map(p => ({
        name: p.product_name_tr || p.product_name || 'İsimsiz',
        brand: p.brands || '',
        calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
        protein: Math.round((p.nutriments['proteins_100g'] || 0) * 10) / 10,
        carbs: Math.round((p.nutriments['carbohydrates_100g'] || 0) * 10) / 10,
        fat: Math.round((p.nutriments['fat_100g'] || 0) * 10) / 10
      }))
    res.status(200).json({ products })
  } catch (err) {
    res.status(500).json({ error: err.response?.status ? `Status ${err.response.status}` : err.message })
  }
}