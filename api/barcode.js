import axios from 'axios'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { code } = req.query
  if (!code) return res.status(400).json({ error: 'code gerekli' })

  try {
    const r = await axios.get(`https://world.openfoodfacts.org/api/v2/product/${code}.json`)
    if (r.data.status !== 1) {
      return res.status(404).json({ error: 'Ürün bulunamadı' })
    }
    const p = r.data.product
    const n = p.nutriments || {}
    res.status(200).json({
      product: {
        name: p.product_name || 'İsimsiz',
        brand: p.brands || '',
        calories: Math.round(n['energy-kcal_100g'] || 0),
        protein: Math.round((n['proteins_100g'] || 0) * 10) / 10,
        carbs: Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
        fat: Math.round((n['fat_100g'] || 0) * 10) / 10
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}