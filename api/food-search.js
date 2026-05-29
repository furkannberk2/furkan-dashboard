import axios from 'axios'

export default async function handler(req, res) {
  const { q } = req.query
  if (!q) return res.status(400).json({ error: 'Query gerekli' })

  try {
    const response = await axios.get('https://world.openfoodfacts.org/cgi/search.pl', {
      params: {
        search_terms: q,
        search_simple: 1,
        action: 'process',
        json: 1,
        page_size: 20,
        fields: 'product_name,brands,nutriments,serving_size'
      },
      headers: { 'User-Agent': 'FurkanDashboard/1.0' }
    })

    const products = (response.data.products || [])
      .filter(p => p.product_name && p.nutriments?.['energy-kcal_100g'])
      .map(p => ({
        name: p.product_name,
        brand: p.brands || '',
        calories: Math.round(p.nutriments['energy-kcal_100g']),
        protein: Math.round(p.nutriments['proteins_100g'] || 0),
        carbs: Math.round(p.nutriments['carbohydrates_100g'] || 0),
        fat: Math.round(p.nutriments['fat_100g'] || 0),
        serving: p.serving_size || '100g'
      }))

    res.status(200).json({ products })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}