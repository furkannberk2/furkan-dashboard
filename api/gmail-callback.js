import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  const { code } = req.query
  if (!code) return res.status(400).send('Kod bulunamadı')

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  try {
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Email adresini al
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()

    // Supabase'e kaydet
    await supabase.from('gmail_accounts').upsert({
      email: userInfo.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: new Date(tokens.expiry_date).toISOString()
    }, { onConflict: 'email' })

    // Dashboard'a geri yönlendir
    res.redirect('/?gmail=connected')
  } catch (err) {
console.error('CALLBACK ERROR:', err.response?.data || err.message)
    res.status(500).send('Hata: ' + JSON.stringify(err.response?.data || err.message))
  }
}