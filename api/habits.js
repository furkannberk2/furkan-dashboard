import axios from 'axios'

const NOTION_TOKEN = process.env.VITE_NOTION_TOKEN
const DATABASE_ID = process.env.VITE_NOTION_DATABASE_ID

const notionHeaders = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json'
}

export default async function handler(req, res) {
  // GET — alışkanlıkları getir
  if (req.method === 'GET') {
    const month = req.query.month || new Date().toLocaleString('en-US', { month: 'long' })
    try {
      const response = await axios.post(
        `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
        {
          filter: { property: 'Month', rich_text: { equals: month } },
          sorts: [{ property: 'Day', direction: 'ascending' }]
        },
        { headers: notionHeaders }
      )
      return res.status(200).json(response.data)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // POST — yeni ay başlat
  if (req.method === 'POST') {
    const { month, days } = req.body
    try {
      const promises = Array.from({ length: days }, (_, i) => {
        const day = i + 1
        const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'
        return axios.post(
          'https://api.notion.com/v1/pages',
          {
            parent: { database_id: DATABASE_ID },
            properties: {
              Day: { title: [{ text: { content: `${day}${suffix}` } }] },
              Month: { rich_text: [{ text: { content: month } }] }
            }
          },
          { headers: notionHeaders }
        )
      })
      await Promise.all(promises)
      return res.status(200).json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}