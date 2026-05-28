import axios from 'axios'

const NOTION_TOKEN = process.env.VITE_NOTION_TOKEN

const notionHeaders = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json'
}

export default async function handler(req, res) {
  if (req.method === 'PATCH') {
    const { pageId } = req.query
    const { property, value } = req.body
    try {
      const response = await axios.patch(
        `https://api.notion.com/v1/pages/${pageId}`,
        { properties: { [property]: { checkbox: value } } },
        { headers: notionHeaders }
      )
      return res.status(200).json(response.data)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }
  res.status(405).json({ error: 'Method not allowed' })
}