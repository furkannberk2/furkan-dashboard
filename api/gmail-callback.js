import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { code, state: userId } = req.query
  if (!code) return res.status(400).send('Kod bulunamadı')
  if (!userId) return res.status(400).send('user_id bulunamadı')

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  try {
    const { tokens } = await client.getToken(code)
    client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const { data: userInfo } = await oauth2.userinfo.get()
    await supabase.from('gmail_accounts').upsert({
      email: userInfo.email,
      user_id: userId,
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