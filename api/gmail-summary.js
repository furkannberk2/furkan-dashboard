import { google } from 'googleapis'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

function getOAuthClient(account) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token
  })
  return client
}

// Mail gövdesinden düz metin çıkar
function extractBody(payload) {
  if (!payload) return ''
  // Düz metin parçası varsa
  if (payload.body?.data) {
    try {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8')
    } catch { return '' }
  }
  // Parçalı (multipart) ise text/plain ara
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        try {
          return Buffer.from(part.body.data, 'base64').toString('utf-8')
        } catch { return '' }
      }
    }
    // text/plain yoksa ilk parçaya in
    for (const part of payload.parts) {
      const nested = extractBody(part)
      if (nested) return nested
    }
  }
  return ''
}

async function getTodayMessages(account) {
  const auth = getOAuthClient(account)
  const gmail = google.gmail({ version: 'v1', auth })

  const startOfDay = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000)

  const list = await gmail.users.messages.list({
    userId: 'me',
    q: `after:${startOfDay}`,
    maxResults: 30
  })

  const messages = list.data.messages || []
  const details = await Promise.all(messages.map(async m => {
    const msg = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' })
    const headers = msg.data.payload.headers
    const from = headers.find(h => h.name === 'From')?.value || ''
    const subject = headers.find(h => h.name === 'Subject')?.value || '(konu yok)'
    const snippet = msg.data.snippet || ''
    // Gövdeyi çek, temizle, kısalt (token tasarrufu)
    let body = extractBody(msg.data.payload)
    body = body.replace(/\s+/g, ' ').replace(/https?:\/\/\S+/g, '').trim().slice(0, 600)
    return { from, subject, snippet, body, account: account.email }
  }))

  return details
}

export default async function handler(req, res) {
  try {
    const { data: accounts } = await supabase.from('gmail_accounts').select('*')
    if (!accounts || accounts.length === 0) {
      return res.status(200).json({ connected: false, summary: null, mails: [] })
    }

    let allMails = []
    for (const account of accounts) {
      try {
        const mails = await getTodayMessages(account)
        allMails = allMails.concat(mails)
      } catch (err) {
        console.error(`${account.email} hatası:`, err.message)
      }
    }

    if (allMails.length === 0) {
      return res.status(200).json({ connected: true, summary: 'Bugün hiç mail gelmemiş.', mails: [], accounts: accounts.map(a => a.email) })
    }

    // Gemini'ye gönderilecek metin — gövde dahil
    const mailText = allMails.map((m, i) =>
      `${i + 1}. [${m.account}] Gönderen: ${m.from} | Konu: ${m.subject} | İçerik: ${m.body || m.snippet}`
    ).join('\n\n')

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `Aşağıda bugün gelen e-postalar var. Türkçe özetle. SADECE düz metin kullan — yıldız (*), kare (#) gibi markdown işaretleri KULLANMA.

Şu kategorilere ayır (bir kategoride mail yoksa o başlığı hiç yazma):

👤 KİŞİSEL
Gerçek kişilerden gelen, sana özel yazılmış mailler.

📌 ÖNEMLİ & AKSİYON
Fatura, doğrulama kodu, hesap onayı, iş/proje ile ilgili, yapılması gereken işler. Önemli detayları (kod, tarih, tutar) belirt.

📰 HABER & ETKİNLİK
Bültenler, etkinlik duyuruları, haber özetleri.

📱 SOSYAL MEDYA
LinkedIn, Instagram, X, Facebook gibi platform bildirimleri.

🔧 UYGULAMALAR
Uygulama ve sistem bildirimleri (Vercel, hosting, geliştirici servisleri vb.).

ÇOK ÖNEMLİ KURAL: "X'ten haber/bülten geldi" gibi açıklamalar YAPMA. Bunun yerine mailin İÇERİĞİNİ özetle. Örnek: "Aposto'dan bülten geldi" DEME — onun yerine "Aposto: [haberin asıl konusu, manşetler, ne olduğu]" yaz. Haber ve bültenlerde içindeki asıl bilgiyi/başlıkları aktar, sadece kimden geldiğini değil.

Her maddeyi yeni satıra yaz, kısa ve net tut, göndereni parantezde belirt.

E-postalar:
${mailText}`

    const result = await model.generateContent(prompt)
    const summary = result.response.text()

    res.status(200).json({
      connected: true,
      summary,
      mails: allMails.map(({ body, ...rest }) => rest), // gövdeyi frontend'e gönderme
      accounts: accounts.map(a => a.email)
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}