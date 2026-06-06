import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const action = req.query.action

  // /api/gmail-auth?action=connect → OAuth URL'si üret
  if (action === 'connect') {
    const client = getOAuthClient()
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email'
      ]
    })
    return res.redirect(url)
  }

  // /api/gmail-auth?action=callback&code=... → token kaydet
  if (action === 'callback') {
    const { code } = req.query
    if (!code) return res.status(400).send('Kod bulunamadı')
    const client = getOAuthClient()
    try {
      const { tokens } = await client.getToken(code)
      client.setCredentials(tokens)
      const oauth2 = google.oauth2({ version: 'v2', auth: client })
      const { data: userInfo } = await oauth2.userinfo.get()
      await supabase.from('gmail_accounts').upsert({
        email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: new Date(tokens.expiry_date).toISOString()
      }, { onConflict: 'email' })
      return res.redirect('/?gmail=connected')
    } catch (err) {
      console.error('CALLBACK ERROR:', err.response?.data || err.message)
      return res.status(500).send('Hata: ' + JSON.stringify(err.response?.data || err.message))
    }
  }

  // /api/gmail-auth?action=status → bağlı hesapları döndür
  if (action === 'status') {
    const { data: accounts } = await supabase.from('gmail_accounts').select('email, token_expiry')
    return res.status(200).json({
      connected: accounts && accounts.length > 0,
      accounts: (accounts || []).map(a => a.email)
    })
  }

  // /api/gmail-auth?action=disconnect&email=... → hesap sil
  if (action === 'disconnect') {
    const { email } = req.query
    if (!email) return res.status(400).json({ error: 'email gerekli' })
    await supabase.from('gmail_accounts').delete().eq('email', email)
    return res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: 'Geçersiz action' })
}