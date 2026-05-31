import axios from 'axios'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { q } = req.query
  if (!q) return res.status(400).json({ error: 'q gerekli' })

  try {
    const r = await axios.get('https://search.openfoodfacts.org/search', {
      params: {
        q,
        page_size: 20,
        fields: 'product_name,brands,nutriments,code'
      }
    })
    const hits = r.data.hits || []
    const products = hits
      .filter(p => p.nutriments?.['energy-kcal_100g'])
      .map(p => ({
        name: p.product_name || 'İsimsiz',
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