import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// ---------- Yardımcılar ----------
const todayStr = () => new Date().toISOString().split('T')[0]
const monthStr = () => todayStr().slice(0, 7)

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ---------- CONTEXT BUILDER ----------
// Her modülü kompakt özetler. Ham veri Gemini'ye asla gitmez.

async function buildFinanceContext(userId) {
  const month = monthStr()
  const today = todayStr()
  const [inc, daily, recurring, variable, settings] = await Promise.all([
    supabase.from('income').select('*').eq('user_id', userId).eq('month', month).maybeSingle(),
    supabase.from('daily_expenses').select('*').eq('user_id', userId),
    supabase.from('recurring_expenses').select('*').eq('user_id', userId),
    supabase.from('variable_budgets').select('*').eq('user_id', userId).eq('month', month),
    supabase.from('user_settings').select('*').eq('user_id', userId).eq('key', 'payday').maybeSingle()
  ])

  const income = inc.data
  const payday = settings.data ? Number(settings.data.value) || 5 : 5
  const totalIncome = income ? Number(income.amount) : 0
  const balance = income?.balance ? Number(income.balance) : null
  const baseAmount = balance || totalIncome

  const dailyExpenses = daily.data || []
  const todaySpent = dailyExpenses.filter(e => e.date === today).reduce((s, e) => s + Number(e.amount), 0)
  const monthSpent = dailyExpenses.filter(e => e.date.startsWith(month)).reduce((s, e) => s + Number(e.amount), 0)

  const totalRecurring = (recurring.data || []).reduce((s, e) => s + Number(e.amount), 0)
  const totalVariable = (variable.data || []).reduce((s, e) => s + Number(e.amount), 0)

  const now = new Date()
  const currentDay = now.getDate()
  let remainingDays
  if (currentDay <= payday) remainingDays = payday - currentDay + 1
  else {
    const nextPay = new Date(now.getFullYear(), now.getMonth() + 1, payday)
    const td = new Date(now.getFullYear(), now.getMonth(), currentDay)
    remainingDays = Math.round((nextPay - td) / (1000 * 60 * 60 * 24)) + 1
  }
  const dailyBudget = baseAmount > 0 ? Math.round((baseAmount - totalRecurring - totalVariable) / remainingDays) : 0

  // Kategori bazında bu ay harcama
  const catMap = {}
  dailyExpenses.filter(e => e.date.startsWith(month)).forEach(e => {
    catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount)
  })
  const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]

  if (totalIncome === 0 && !balance) return 'FİNANS: Gelir/bakiye girilmemiş.'

  return `FİNANS: ${balance ? `Bakiye ${balance.toLocaleString('tr-TR')}₺` : `Aylık gelir ${totalIncome.toLocaleString('tr-TR')}₺`}. ` +
    `Bu ay harcanan: ${monthSpent.toLocaleString('tr-TR')}₺. Bugün: ${todaySpent.toLocaleString('tr-TR')}₺. ` +
    `Günlük limit: ${dailyBudget.toLocaleString('tr-TR')}₺ (${remainingDays} gün kaldı)${todaySpent > dailyBudget ? ' — BUGÜN LİMİT AŞILDI' : ''}. ` +
    `Sabit giderler: ${totalRecurring.toLocaleString('tr-TR')}₺/ay. Değişken bütçe: ${totalVariable.toLocaleString('tr-TR')}₺. ` +
    (topCat ? `En çok harcama: ${topCat[0]} (${topCat[1].toLocaleString('tr-TR')}₺).` : '')
}

async function buildInvestmentContext(userId) {
  const { data } = await supabase.from('investments').select('*').eq('user_id', userId)
  if (!data || data.length === 0) return 'YATIRIM: Portföy boş.'
  const byType = {}
  data.forEach(i => { byType[i.type] = (byType[i.type] || 0) + 1 })
  const summary = Object.entries(byType).map(([t, c]) => `${t}: ${c}`).join(', ')
  return `YATIRIM: ${data.length} pozisyon (${summary}). Güncel TL değerleri için Finans sayfasına bakılmalı.`
}

async function buildHealthContext(userId) {
  const today = todayStr()
  const [entries, goal] = await Promise.all([
    supabase.from('food_entries').select('*').eq('user_id', userId).eq('date', today),
    supabase.from('calorie_goals').select('*').eq('user_id', userId).maybeSingle()
  ])
  const list = entries.data || []
  const totalCal = list.reduce((s, e) => s + Number(e.calories), 0)
  const goalCal = goal.data?.daily_calories || 2000
  const protein = list.reduce((s, e) => s + Number(e.protein || 0), 0)

  // Son 7 gün ortalama
  const weekAgo = addDays(today, -7)
  const { data: weekData } = await supabase.from('food_entries').select('date, calories').eq('user_id', userId).gte('date', weekAgo)
  const byDay = {}
  ;(weekData || []).forEach(e => { byDay[e.date] = (byDay[e.date] || 0) + Number(e.calories) })
  const days = Object.values(byDay)
  const avg = days.length > 0 ? Math.round(days.reduce((s, v) => s + v, 0) / days.length) : 0

  return `SAĞLIK: Bugün ${totalCal}/${goalCal} kcal (${goalCal - totalCal > 0 ? `${goalCal - totalCal} kalan` : 'aşıldı'}), protein ${protein}g. ` +
    `Son 7 gün ortalama: ${avg} kcal/gün.`
}

async function buildTaskContext(userId) {
  const today = todayStr()
  const { data } = await supabase.from('tasks').select('*').eq('user_id', userId).neq('status', 'done')
  const list = data || []
  const todayTasks = list.filter(t => t.day === today)
  const overdue = list.filter(t => t.day && t.day < today)
  const upcoming = list.filter(t => t.day && t.day > today && t.day <= addDays(today, 7))

  return `GÖREVLER: Bugün ${todayTasks.length} açık görev. Gecikmiş: ${overdue.length}. ` +
    `Önümüzdeki 7 günde: ${upcoming.length}. ` +
    (overdue.length > 0 ? `Gecikmişler: ${overdue.slice(0, 3).map(t => t.title).join(', ')}.` : '') +
    (todayTasks.length > 0 ? ` Bugünküler: ${todayTasks.slice(0, 4).map(t => t.title).join(', ')}.` : '')
}

async function buildHabitContext(userId) {
  const today = todayStr()
  const [habits, logs] = await Promise.all([
    supabase.from('habits').select('*').eq('user_id', userId),
    supabase.from('habit_logs').select('*').eq('user_id', userId).eq('date', today)
  ])
  const habitList = habits.data || []
  const doneToday = (logs.data || []).filter(l => l.done).map(l => l.habit_id)
  const done = habitList.filter(h => doneToday.includes(h.id))
  const missed = habitList.filter(h => !doneToday.includes(h.id))

  if (habitList.length === 0) return 'ALIŞKANLIKLAR: Henüz yok.'
  return `ALIŞKANLIKLAR: Bugün ${done.length}/${habitList.length} tamamlandı. ` +
    (missed.length > 0 ? `Kaçırılan: ${missed.map(h => h.name).join(', ')}.` : 'Hepsi tamam!')
}

async function buildProjectContext(userId) {
  const [projects, ptasks] = await Promise.all([
    supabase.from('projects').select('*').eq('user_id', userId),
    supabase.from('project_tasks').select('*').eq('user_id', userId)
  ])
  const list = projects.data || []
  if (list.length === 0) return 'PROJELER: Henüz yok.'
  const active = list.filter(p => p.status === 'aktif')
  const summary = active.slice(0, 5).map(p => {
    const open = (ptasks.data || []).filter(pt => pt.project_id === p.id && pt.status !== 'done').length
    return `${p.name} (%${p.progress}, ${open} açık aşama)`
  }).join('; ')
  return `PROJELER: ${active.length} aktif proje. ${summary}.`
}

async function buildFullContext(userId) {
  const [fin, inv, health, task, habit, project] = await Promise.all([
    buildFinanceContext(userId),
    buildInvestmentContext(userId),
    buildHealthContext(userId),
    buildTaskContext(userId),
    buildHabitContext(userId),
    buildProjectContext(userId)
  ])
  return [fin, inv, health, task, habit, project].join('\n')
}

// ---------- AKSİYONLAR (Function Calling) ----------
const toolDeclarations = [
  {
    name: 'add_task',
    description: 'Kullanıcıya yeni bir görev ekler',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Görev başlığı' },
        day: { type: 'string', description: 'Tarih YYYY-MM-DD formatında. Belirtilmezse bugün.' },
        priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Öncelik' },
        note: { type: 'string', description: 'İsteğe bağlı detay' }
      },
      required: ['title']
    }
  },
  {
    name: 'add_habit',
    description: 'Yeni bir günlük alışkanlık ekler',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Alışkanlık adı' } },
      required: ['name']
    }
  },
  {
    name: 'set_calorie_goal',
    description: 'Günlük kalori hedefini belirler veya günceller',
    parameters: {
      type: 'object',
      properties: { daily_calories: { type: 'number', description: 'Günlük kalori hedefi' } },
      required: ['daily_calories']
    }
  },
  {
    name: 'add_daily_expense',
    description: 'Bugün için bir harcama kaydeder',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Tutar (TL)' },
        category: { type: 'string', description: 'Kategori: Market, Yemek, Ulaşım, Kafe, Giyim, Sağlık, Eğlence, Diğer' },
        description: { type: 'string', description: 'Açıklama' }
      },
      required: ['amount', 'category']
    }
  },
  {
    name: 'add_recurring_expense',
    description: 'Aylık tekrar eden sabit gider ekler (kira, abonelik, fatura vb.)',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Gider adı' },
        amount: { type: 'number', description: 'Aylık tutar (TL)' },
        category: { type: 'string', description: 'Kategori: Kira, Fatura, Borç, Abonelik, Diğer' },
        due_day: { type: 'number', description: 'Ayın kaçında ödeniyor (1-31), opsiyonel' }
      },
      required: ['name', 'amount', 'category']
    }
  },
  {
    name: 'add_variable_budget',
    description: 'Bu ay için değişken bütçe kalemi ekler (yatırım hedefi, tatil fonu vb.). Bu, günlük harcama limitini otomatik düşürür.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Bütçe kalemi adı (örn. Yatırım, Tatil)' },
        amount: { type: 'number', description: 'Bu ay ayrılacak tutar (TL)' }
      },
      required: ['name', 'amount']
    }
  },
  {
    name: 'add_project',
    description: 'Yeni bir proje oluşturur. İsteğe bağlı olarak aşamalar da eklenebilir.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Proje adı' },
        icon: { type: 'string', description: 'Emoji, opsiyonel' },
        phases: {
          type: 'array',
          description: 'Proje aşamaları, opsiyonel',
          items: { type: 'string' }
        }
      },
      required: ['name']
    }
  }
]

const PROJECT_COLORS = ['#6366f1', '#f472b6', '#fb923c', '#60a5fa', '#a78bfa', '#6ee7b7', '#fbbf24', '#f87171']

async function executeAction(name, args, userId) {
  const today = todayStr()
  try {
    if (name === 'add_task') {
      await supabase.from('tasks').insert({
        title: args.title, type: 'todo', day: args.day || today,
        status: 'todo', priority: args.priority || 'medium',
        note: args.note || null, user_id: userId
      })
      return `"${args.title}" görevi ${args.day || 'bugüne'} eklendi`
    }
    if (name === 'add_habit') {
      const { data: existing } = await supabase.from('habits').select('position').eq('user_id', userId).order('position', { ascending: false }).limit(1)
      const nextPos = existing && existing.length > 0 ? (existing[0].position || 0) + 1 : 0
      await supabase.from('habits').insert({ name: args.name, position: nextPos, user_id: userId })
      return `"${args.name}" alışkanlığı eklendi`
    }
    if (name === 'set_calorie_goal') {
      const { data: goal } = await supabase.from('calorie_goals').select('*').eq('user_id', userId).maybeSingle()
      if (goal) await supabase.from('calorie_goals').update({ daily_calories: args.daily_calories, updated_at: new Date() }).eq('id', goal.id)
      else await supabase.from('calorie_goals').insert({ daily_calories: args.daily_calories, user_id: userId })
      return `Günlük kalori hedefi ${args.daily_calories} olarak ayarlandı`
    }
    if (name === 'add_daily_expense') {
      await supabase.from('daily_expenses').insert({
        date: today, category: args.category, description: args.description || null,
        amount: args.amount, user_id: userId
      })
      return `${args.amount}₺ ${args.category} harcaması eklendi`
    }
    if (name === 'add_recurring_expense') {
      await supabase.from('recurring_expenses').insert({
        name: args.name, category: args.category, amount: args.amount,
        due_day: args.due_day || null, user_id: userId
      })
      return `"${args.name}" sabit gideri (${args.amount}₺/ay) eklendi`
    }
    if (name === 'add_variable_budget') {
      await supabase.from('variable_budgets').insert({
        month: monthStr(), name: args.name, amount: args.amount, user_id: userId
      })
      return `"${args.name}" bütçe kalemi (${args.amount}₺) eklendi, günlük limit güncellendi`
    }
    if (name === 'add_project') {
      const color = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]
      const { data: proj } = await supabase.from('projects').insert({
        name: args.name, icon: args.icon || null, color,
        status: 'aktif', progress: 0, progress_manual: false, user_id: userId
      }).select().single()
      if (args.phases && args.phases.length > 0 && proj) {
        const phaseRows = args.phases.map(title => ({
          project_id: proj.id, title, status: 'todo', user_id: userId
        }))
        await supabase.from('project_tasks').insert(phaseRows)
      }
      return `"${args.name}" projesi${args.phases?.length ? ` ${args.phases.length} aşamayla` : ''} oluşturuldu`
    }
    return 'Bilinmeyen aksiyon'
  } catch (err) {
    return `Aksiyon hatası: ${err.message}`
  }
}

// ---------- SİSTEM PROMPTU ----------
function buildSystemPrompt(tone, context) {
  const toneDesc = {
    motive: 'Enerjik, motive edici bir antrenör gibisin. Kullanıcıyı harekete geçir, başarılarını kutla, cesaretlendir.',
    sakin: 'Sakin, bilge bir mentor gibisin. Yargılamadan, sabırla ve derinlemesine yaklaş.',
    direkt: 'Direkt ve nettsin. Laf kalabalığı yapmazsın, veriye dayalı net tavsiyeler verirsin.'
  }
  return `Sen kullanıcının kişisel yaşam koçusun. Elinde onun gerçek verileri var.

KİŞİLİK: ${toneDesc[tone] || toneDesc.motive}

KURALLAR:
- Sadece aşağıdaki verilere dayan, rakam uydurma.
- Somut ve kişisel ol. Genel geçer tavsiyelerden kaçın.
- Türkçe, samimi ama saygılı konuş. Kısa ve doğal, madde madde değil.
- Kullanıcı bir şey eklemek/ayarlamak isterse ilgili aracı (function) kullan. Aracı kullandıktan sonra ne yaptığını doğal dille kısaca söyle.
- Emin olmadığın durumda kullanıcıya sor, tahminle aksiyon alma.

KULLANICININ GÜNCEL DURUMU:
${context}`
}

// ---------- ANA HANDLER ----------
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST gerekli' })

  const { action, user_id, message } = req.body || {}
  if (!user_id) return res.status(400).json({ error: 'user_id gerekli' })

  try {
    // Ayarları çek (tone)
    const { data: settings } = await supabase.from('coach_settings').select('*').eq('user_id', user_id).maybeSingle()
    const tone = settings?.tone || 'motive'

    // === CHAT MODU ===
    if (action === 'chat') {
      if (!message) return res.status(400).json({ error: 'message gerekli' })

      // Son 10 mesajı çek (konuşma geçmişi)
      const { data: history } = await supabase.from('coach_messages')
        .select('*').eq('user_id', user_id)
        .order('created_at', { ascending: false }).limit(10)
      const orderedHistory = (history || []).reverse()

      // Context oluştur
      const context = await buildFullContext(user_id)
      const systemPrompt = buildSystemPrompt(tone, context)

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        tools: [{ functionDeclarations: toolDeclarations }],
        systemInstruction: systemPrompt
      })

      // Geçmişi Gemini formatına çevir
      const chatHistory = orderedHistory.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))

      const chat = model.startChat({ history: chatHistory })

      // Kullanıcı mesajını kaydet
      await supabase.from('coach_messages').insert({ user_id, role: 'user', content: message })

      let result = await chat.sendMessage(message)
      let actionsTaken = []

      // Function call döngüsü (koç aksiyon almak isteyebilir)
      let loopGuard = 0
      while (loopGuard < 5) {
        loopGuard++
        const calls = result.response.functionCalls()
        if (!calls || calls.length === 0) break

        const responses = []
        for (const call of calls) {
          const resultText = await executeAction(call.name, call.args, user_id)
          actionsTaken.push({ name: call.name, args: call.args, result: resultText })
          responses.push({
            functionResponse: { name: call.name, response: { result: resultText } }
          })
        }
        result = await chat.sendMessage(responses)
      }

      const replyText = result.response.text()

      // Koç cevabını kaydet
      await supabase.from('coach_messages').insert({
        user_id, role: 'assistant', content: replyText,
        action_taken: actionsTaken.length > 0 ? actionsTaken : null
      })

      return res.status(200).json({ reply: replyText, actions: actionsTaken })
    }

    // === GEÇMİŞ ÇEKME ===
    if (action === 'history') {
      const { data } = await supabase.from('coach_messages')
        .select('*').eq('user_id', user_id)
        .order('created_at', { ascending: true }).limit(50)
      return res.status(200).json({ messages: data || [] })
    }

    // === AYAR GÜNCELLEME ===
    if (action === 'set_tone') {
      const { tone: newTone } = req.body
      await supabase.from('coach_settings').upsert({ user_id, tone: newTone, updated_at: new Date() }, { onConflict: 'user_id' })
      return res.status(200).json({ ok: true })
    }

    // === GEÇMİŞ TEMİZLEME ===
    if (action === 'clear') {
      await supabase.from('coach_messages').delete().eq('user_id', user_id)
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Geçersiz action' })
  } catch (err) {
    console.error('COACH ERROR:', err)
    return res.status(500).json({ error: err.message })
  }
}