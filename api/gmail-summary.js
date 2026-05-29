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

async function getTodayMessages(account) {
  const auth = getOAuthClient(account)
  const gmail = google.gmail({ version: 'v1', auth })

  // Bugünün başlangıcı (epoch saniye)
  const startOfDay = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000)

  const list = await gmail.users.messages.list({
    userId: 'me',
    q: `after:${startOfDay}`,
    maxResults: 30
  })

  const messages = list.data.messages || []
  const details = await Promise.all(messages.map(async m => {
    const msg = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'Subject'] })
    const headers = msg.data.payload.headers
    const from = headers.find(h => h.name === 'From')?.value || ''
    const subject = headers.find(h => h.name === 'Subject')?.value || '(konu yok)'
    const snippet = msg.data.snippet || ''
    return { from, subject, snippet, account: account.email }
  }))

  return details
}

export default async function handler(req, res) {
  try {
    const { data: accounts } = await supabase.from('gmail_accounts').select('*')
    if (!accounts || accounts.length === 0) {
      return res.status(200).json({ connected: false, summary: null, mails: [] })
    }

    // Tüm hesaplardan mailleri topla
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

    // Gemini ile özetle
    const mailText = allMails.map((m, i) => `${i + 1}. [${m.account}] ${m.from} — ${m.subject}: ${m.snippet}`).join('\n')
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const prompt = `Aşağıda bugün gelen e-postalar var. Bunları Türkçe, kısa ve öz şekilde özetle. Önemli olanları vurgula, spam/bülten gibi olanları grupla. Madde madde, sade bir dille yaz:\n\n${mailText}`

    const result = await model.generateContent(prompt)
    const summary = result.response.text()

    res.status(200).json({
      connected: true,
      summary,
      mails: allMails,
      accounts: accounts.map(a => a.email)
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}