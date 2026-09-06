import axios from 'axios'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  // === FOTOĞRAFTAN KALORİ (POST) ===
  // food-search?action=photo  +  body: { image: base64, mimeType, lang }
  if (req.method === 'POST' && req.query.action === 'photo') {
    return handlePhoto(req, res)
  }

  // === METİNDEN KALORİ (POST) ===
  // food-search?action=text  +  body: { text, lang }
  if (req.method === 'POST' && req.query.action === 'text') {
    return handleText(req, res)
  }

  // === METİN ARAMASI (GET, mevcut davranış) ===
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
      .filter(p => (p.product_name_tr || p.product_name))
      .map(p => ({
        name: p.product_name_tr || p.product_name || 'İsimsiz',
        brand: p.brands || '',
        calories: Math.round(p.nutriments?.['energy-kcal_100g'] || 0),
        protein: Math.round((p.nutriments?.['proteins_100g'] || 0) * 10) / 10,
        carbs: Math.round((p.nutriments?.['carbohydrates_100g'] || 0) * 10) / 10,
        fat: Math.round((p.nutriments?.['fat_100g'] || 0) * 10) / 10
      }))
      .sort((a, b) => (b.calories > 0 ? 1 : 0) - (a.calories > 0 ? 1 : 0))
      .slice(0, 25)

    res.status(200).json({ products })
  } catch (err) {
    res.status(500).json({ error: err.response?.status ? `Status ${err.response.status}` : err.message })
  }
}

// === Fotoğraf analiz fonksiyonu ===
async function handlePhoto(req, res) {
  try {
    const { image, mimeType = 'image/jpeg', lang = 'tr' } = req.body || {}
    if (!image) return res.status(400).json({ error: 'image gerekli' })

    // base64 başlığını temizle (data:image/jpeg;base64,... gelebilir)
    const base64 = image.includes(',') ? image.split(',')[1] : image

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const promptTR = `Bu bir yemek fotoğrafı. Fotoğraftaki yiyecek ve içecekleri analiz et.

KURALLAR:
- Tabakta tek bir yemek varsa tek öğe döndür.
- Birden fazla ayrı yiyecek varsa (örn. pilav + tavuk + salata) her birini AYRI öğe olarak döndür.
- Her öğe için: isim (Türkçe, kısa), tahmini porsiyon miktarı (gram), ve o porsiyonun toplam kalorisi.
- Kalori tahminini gördüğün porsiyon büyüklüğüne göre yap (100g başına değil, TABAKTAKİ gerçek miktar).
- Emin olamadığın yerde makul bir tahmin yap, boş bırakma.
- Yemek olmayan bir fotoğrafsa boş liste döndür.

SADECE şu JSON formatında yanıt ver, başka hiçbir şey yazma (markdown, açıklama YOK):
{"items":[{"name":"Pilav","grams":200,"calories":260},{"name":"Izgara Tavuk","grams":150,"calories":250}]}`

    const promptEN = `This is a food photo. Analyze the foods and drinks in it.

RULES:
- If there is a single dish, return a single item.
- If there are multiple separate foods (e.g. rice + chicken + salad), return each as a SEPARATE item.
- For each item: name (English, short), estimated portion size (grams), and total calories for that portion.
- Base the calorie estimate on the portion size you see (not per 100g, the ACTUAL amount on the plate).
- Where unsure, make a reasonable estimate, don't leave blank.
- If the photo is not food, return an empty list.

Respond ONLY in this JSON format, nothing else (NO markdown, NO explanation):
{"items":[{"name":"Rice","grams":200,"calories":260},{"name":"Grilled Chicken","grams":150,"calories":250}]}`

    const prompt = lang === 'en' ? promptEN : promptTR

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType, data: base64 } }
    ])

    let text = result.response.text().trim()
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim()

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      parsed = match ? JSON.parse(match[0]) : { items: [] }
    }

    const items = (parsed.items || [])
      .filter(it => it && it.name)
      .map(it => ({
        name: String(it.name).slice(0, 60),
        grams: Math.max(0, Math.round(Number(it.grams) || 0)),
        calories: Math.max(0, Math.round(Number(it.calories) || 0))
      }))

    res.status(200).json({ items })
  } catch (err) {
    console.error('Photo analysis error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

// === Metinden kalori analiz fonksiyonu ===
async function handleText(req, res) {
  try {
    const { text, lang = 'tr' } = req.body || {}
    if (!text || !text.trim()) return res.status(400).json({ error: 'text gerekli' })

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const promptTR = `Kullanıcı ne yediğini yazdı: "${text}"

Bu metindeki yiyecek ve içecekleri analiz et.

KURALLAR:
- Birden fazla ayrı yiyecek varsa (örn. "2 yumurta ve bir dilim ekmek") her birini AYRI öğe olarak döndür.
- Her öğe için: isim (Türkçe, kısa), tahmini miktar (gram), ve o miktarın toplam kalorisi.
- Kalori tahminini kendi beslenme bilgine göre yap.
- Kullanıcı miktar belirtmişse (2 yumurta, yarım tabak) ona göre hesapla; belirtmemişse makul bir porsiyon varsay.
- Yiyecek/içecek olmayan bir metinse boş liste döndür.

SADECE şu JSON formatında yanıt ver, başka hiçbir şey yazma (markdown, açıklama YOK):
{"items":[{"name":"Yumurta (2 adet)","grams":100,"calories":140},{"name":"Ekmek (1 dilim)","grams":30,"calories":80}]}`

    const promptEN = `The user wrote what they ate: "${text}"

Analyze the foods and drinks in this text.

RULES:
- If there are multiple separate foods (e.g. "2 eggs and a slice of bread") return each as a SEPARATE item.
- For each item: name (English, short), estimated amount (grams), and total calories for that amount.
- Base the calorie estimate on your nutrition knowledge.
- If the user gave a quantity (2 eggs, half a plate) calculate accordingly; if not, assume a reasonable portion.
- If the text is not about food/drink, return an empty list.

Respond ONLY in this JSON format, nothing else (NO markdown, NO explanation):
{"items":[{"name":"Eggs (2)","grams":100,"calories":140},{"name":"Bread (1 slice)","grams":30,"calories":80}]}`

    const prompt = lang === 'en' ? promptEN : promptTR

    const result = await model.generateContent(prompt)
    let out = result.response.text().trim()
    out = out.replace(/```json/gi, '').replace(/```/g, '').trim()

    let parsed
    try {
      parsed = JSON.parse(out)
    } catch {
      const match = out.match(/\{[\s\S]*\}/)
      parsed = match ? JSON.parse(match[0]) : { items: [] }
    }

    const items = (parsed.items || [])
      .filter(it => it && it.name)
      .map(it => ({
        name: String(it.name).slice(0, 60),
        grams: Math.max(0, Math.round(Number(it.grams) || 0)),
        calories: Math.max(0, Math.round(Number(it.calories) || 0))
      }))

    res.status(200).json({ items })
  } catch (err) {
    console.error('Text analysis error:', err.message)
    res.status(500).json({ error: err.message })
  }
}