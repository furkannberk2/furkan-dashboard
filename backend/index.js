const express = require('express')
const cors = require('cors')
const axios = require('axios')
require('dotenv').config({ path: '../.env' })

const app = express()
app.use(cors())
app.use(express.json())

const NOTION_TOKEN = process.env.VITE_NOTION_TOKEN
const DATABASE_ID = process.env.VITE_NOTION_DATABASE_ID

const notionHeaders = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json'
}

// Belirli ay ve yılın alışkanlıklarını getir
app.get('/api/habits', async (req, res) => {
  const { month, year } = req.query
  const filterMonth = month || new Date().toLocaleString('en-US', { month: 'long' })

  try {
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        filter: {
          property: 'Month',
          rich_text: { equals: filterMonth }
        },
        sorts: [{ property: 'Day', direction: 'ascending' }]
      },
      { headers: notionHeaders }
    )
    res.json(response.data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Alışkanlık güncelle
app.patch('/api/habits/:pageId', async (req, res) => {
  try {
    const { pageId } = req.params
    const { property, value } = req.body
    const response = await axios.patch(
      `https://api.notion.com/v1/pages/${pageId}`,
      { properties: { [property]: { checkbox: value } } },
      { headers: notionHeaders }
    )
    res.json(response.data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Yeni ay için satırlar oluştur
app.post('/api/habits/init-month', async (req, res) => {
  const { month, year, days } = req.body
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
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(3001, () => console.log('Backend çalışıyor: http://localhost:3001'))