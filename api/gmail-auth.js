import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

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

  if (action === 'connect') {
    const userId = req.query.user_id
    if (!userId) return res.status(400).send('user_id gerekli')
    const client = getOAuthClient()
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      state: userId
    })
    return res.redirect(url)
  }

  if (action === 'status') {
    const userId = req.query.user_id
    if (!userId) return res.status(400).json({ error: 'user_id gerekli' })
    const { data: accounts } = await supabase
      .from('gmail_accounts')
      .select('email, token_expiry')
      .eq('user_id', userId)
    return res.status(200).json({
      connected: accounts && accounts.length > 0,
      accounts: (accounts || []).map(a => a.email)
    })
  }

  if (action === 'disconnect') {
    const { email, user_id } = req.query
    if (!email || !user_id) return res.status(400).json({ error: 'email ve user_id gerekli' })
    await supabase.from('gmail_accounts').delete().eq('email', email).eq('user_id', user_id)
    return res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: 'Geçersiz action' })
}