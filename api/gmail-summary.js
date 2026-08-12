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

  // Token süresi dolduysa yenile
  const now = Date.now()
  const expiry = account.token_expiry ? new Date(account.token_expiry).getTime() : 0
  if (expiry < now + 60000) { // 1 dakika öncesinden yenile
    try {
      const { credentials } = await client.refreshAccessToken()
      client.setCredentials(credentials)
      // Supabase'i güncelle
      await supabase.from('gmail_accounts').update({
        access_token: credentials.access_token,
        token_expiry: new Date(credentials.expiry_date).toISOString()
      }).eq('email', account.email)
    } catch (refreshErr) {
      console.error('Token refresh failed:', refreshErr.message)
      // Refresh başarısız — bu hesabı sil ki kullanıcı yeniden bağlasın
      await supabase.from('gmail_accounts').delete().eq('email', account.email)
      throw new Error('TOKEN_EXPIRED')
    }
  }

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
  const auth = await getOAuthClient(account)  // await ekle
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
    const userId = req.query.user_id
    const force = req.query.force === '1'
    if (!userId) return res.status(400).json({ error: 'user_id gerekli' })

    const today = new Date().toISOString().split('T')[0]

    // Cache kontrolü — force=1 değilse bugünün özetini cache'ten dön
    if (!force) {
      const { data: cached } = await supabase
        .from('mail_summaries')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle()
      if (cached) {
        return res.status(200).json({
          connected: true,
          summary: cached.summary,
          mails: cached.mails || [],
          accounts: cached.accounts || [],
          cached: true
        })
      }
    }

    const { data: accounts } = await supabase
      .from('gmail_accounts')
      .select('*')
      .eq('user_id', userId)

    // Kullanıcının dil tercihi (özet bu dilde olacak)
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('language')
      .eq('user_id', userId)
      .maybeSingle()
    const lang = prefs?.language === 'en' ? 'en' : 'tr'

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
      const noMail = lang === 'en' ? 'No emails received today.' : 'Bugün hiç mail gelmemiş.'
      return res.status(200).json({ connected: true, summary: noMail, mails: [], accounts: accounts.map(a => a.email) })
    }

    const mailText = allMails.map((m, i) =>
      `${i + 1}. [${m.account}] Gönderen: ${m.from} | Konu: ${m.subject} | İçerik: ${m.body || m.snippet}`
    ).join('\n\n')

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const promptTR = `Aşağıda bugün gelen e-postalar var. Türkçe özetle. SADECE düz metin kullan — yıldız (*), kare (#) gibi markdown işaretleri KULLANMA.

Şu kategorilere ayır (bir kategoride mail yoksa o başlığı hiç yazma):

👤 KİŞİSEL
Gerçek kişilerden gelen, sana özel yazılmış mailler.

📌 ÖNEMLİ & AKSİYON
Fatura, doğrulama kodu, hesap onayı, iş/proje ile ilgili, yapılması gereken işler. Önemli detayları (kod, tarih, tutar) belirt.

📰 HABER & ETKİNLİK
Bültenler, etkinlik duyuruları, haber özetleri.
Burada biraz detay verilebilir mailden.

📱 SOSYAL MEDYA
LinkedIn, Instagram, X, Facebook gibi platform bildirimleri.

🔧 UYGULAMALAR
Uygulama ve sistem bildirimleri (Vercel, hosting, geliştirici servisleri vb.).

ÇOK ÖNEMLİ KURAL: "X'ten haber/bülten geldi" gibi açıklamalar YAPMA. Bunun yerine mailin İÇERİĞİNİ özetle. Örnek: "Aposto'dan bülten geldi" DEME — onun yerine "Aposto: [haberin asıl konusu, manşetler, ne olduğu]" yaz. Haber ve bültenlerde içindeki asıl bilgiyi/başlıkları aktar ve içerikte anahtar bilgi ve mesajları da getir, sadece kimden geldiğini değil.

Her maddeyi yeni satıra yaz, kısa ve net tut, göndereni parantezde belirt.

E-postalar:
${mailText}`

    const promptEN = `Below are today's emails. Summarize them in English. Use PLAIN TEXT ONLY — do NOT use markdown symbols like asterisks (*) or hashes (#).

Group into these categories (skip any category header that has no emails):

👤 PERSONAL
Emails from real people, written personally to you.

📌 IMPORTANT & ACTION
Invoices, verification codes, account confirmations, work/project related, things that need doing. State key details (code, date, amount).

📰 NEWS & EVENTS
Newsletters, event announcements, news digests.
Some detail from the email can be included here.

📱 SOCIAL MEDIA
Platform notifications like LinkedIn, Instagram, X, Facebook.

🔧 APPS
App and system notifications (Vercel, hosting, developer services, etc.).

VERY IMPORTANT RULE: Do NOT write explanations like "a newsletter arrived from X". Instead summarize the CONTENT of the email. Example: don't say "a newsletter arrived from Aposto" — instead write "Aposto: [the actual topic, headlines, what happened]". For news and newsletters, convey the actual information/headlines inside, and include key messages, not just who sent it.

Write each item on a new line, keep it short and clear, note the sender in parentheses.

Emails:
${mailText}`

    const prompt = lang === 'en' ? promptEN : promptTR

    const result = await model.generateContent(prompt)
    const summary = result.response.text()

    const cleanMails = allMails.map(({ body, ...rest }) => rest)
    const accountEmails = accounts.map(a => a.email)

    // Cache'e kaydet
    await supabase.from('mail_summaries').upsert({
      user_id: userId,
      date: today,
      summary,
      mails: cleanMails,
      accounts: accountEmails
    }, { onConflict: 'user_id,date' })

    res.status(200).json({
      connected: true,
      summary,
      mails: cleanMails,
      accounts: accountEmails
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}