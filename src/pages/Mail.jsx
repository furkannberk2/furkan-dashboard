import { google } from 'googleapis'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

async function getOAuthClient(account) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.token_expiry ? new Date(account.token_expiry).getTime() : null
  })

  const now = Date.now()
  const expiry = account.token_expiry ? new Date(account.token_expiry).getTime() : 0
  if (expiry < now + 60000) {
    try {
      const { credentials } = await client.refreshAccessToken()
      client.setCredentials(credentials)
      await supabase.from('gmail_accounts').update({
        access_token: credentials.access_token,
        token_expiry: new Date(credentials.expiry_date).toISOString()
      }).eq('email', account.email)
    } catch (refreshErr) {
      console.error('Token refresh failed:', refreshErr.message)
      await supabase.from('gmail_accounts').delete().eq('email', account.email)
      throw new Error('TOKEN_EXPIRED')
    }
  }

  return client
}

function extractBody(payload) {
  if (!payload) return ''
  if (payload.body?.data) {
    try {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8')
    } catch { return '' }
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        try {
          return Buffer.from(part.body.data, 'base64').toString('utf-8')
        } catch { return '' }
      }
    }
    for (const part of payload.parts) {
      const nested = extractBody(part)
      if (nested) return nested
    }
  }
  return ''
}

async function getTodayMessages(account) {
  const auth = await getOAuthClient(account)
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
    let body = extractBody(msg.data.payload)
    body = body.replace(/\s+/g, ' ').replace(/https?:\/\/\S+/g, '').trim().slice(0, 600)
    return { from, subject, snippet, body, account: account.email }
  }))

  return details
}

export default async function handler(req, res) {
  try {
    const userId = req.query.user_id
    if (!userId) return res.status(400).json({ error: 'user_id gerekli' })

    const { data: accounts } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('user_id', userId)

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

ÇOK ÖNEMLİ KURAL: "X'ten haber/bülten geldi" gibi açıklamalar YAPMA. Bunun yerine mailin İÇERİĞİNİ özetle. Örnek: "Aposto'dan bülten geldi" DEME — onun yerine "Aposto: [haberin asıl konusu, manşetler, ne olduğu]" yaz. Haber ve bültenlerde içindeki asıl bilgiyi/başlıkları aktar ve içerikte anahtar bilgi ve mesajları da getir, sadece kimden geldiğini değil.

Her maddeyi yeni satıra yaz, kısa ve net tut, göndereni parantezde belirt.

E-postalar:
${mailText}`

    const result = await model.generateContent(prompt)
    const summary = result.response.text()

    res.status(200).json({
      connected: true,
      summary,
      mails: allMails.map(({ body, ...rest }) => rest),
      accounts: accounts.map(a => a.email)
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}