import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BACKEND } from '../config'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const GOLD_GRAMS = { GOLD_QUARTER: 1.6, GOLD_HALF: 3.2, GOLD_FULL: 6.4 }

function Home() {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const currentMonth = todayStr.slice(0, 7)

  // Data
  const [tasks, setTasks] = useState([])
  const [habitsPage, setHabitsPage] = useState(null)
  const [habitNames, setHabitNames] = useState([])
  const [foodEntries, setFoodEntries] = useState([])
  const [calorieGoal, setCalorieGoal] = useState(null)
  const [dailyExpenses, setDailyExpenses] = useState([])
  const [recurringExpenses, setRecurringExpenses] = useState([])
  const [variableBudgets, setVariableBudgets] = useState([])
  const [income, setIncome] = useState(null)
  const [investments, setInvestments] = useState([])
  const [rates, setRates] = useState({})
  const [quotes, setQuotes] = useState({})
  const [mailData, setMailData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (investments.length > 0) fetchPrices() }, [investments])

  async function fetchAll() {
    try {
      const [t, daily, recurring, variable, inv, inc, food, goal] = await Promise.all([
        supabase.from('tasks').select('*'),
        supabase.from('daily_expenses').select('*'),
        supabase.from('recurring_expenses').select('*'),
        supabase.from('variable_budgets').select('*').eq('month', currentMonth),
        supabase.from('investments').select('*'),
        supabase.from('income').select('*').eq('month', currentMonth).single(),
        supabase.from('food_entries').select('*').eq('date', todayStr),
        supabase.from('calorie_goals').select('*').limit(1).single()
      ])
      if (!t.error) setTasks(t.data)
      if (!daily.error) setDailyExpenses(daily.data)
      if (!recurring.error) setRecurringExpenses(recurring.data)
      if (!variable.error) setVariableBudgets(variable.data)
      if (!inv.error) setInvestments(inv.data)
      if (!inc.error && inc.data) setIncome(inc.data)
      if (!food.error) setFoodEntries(food.data)
      if (!goal.error && goal.data) setCalorieGoal(goal.data)

      // Notion habits
      try {
        const month = MONTHS[today.getMonth()]
        const r = await fetch(`${BACKEND}/api/habits?month=${month}`)
        const data = await r.json()
        const pages = data.results || []
        const dayNum = today.getDate()
        const todayPage = pages.find(p => {
          const title = p.properties['Day']?.title?.[0]?.plain_text
          return parseInt(title) === dayNum
        })
        if (todayPage) {
          setHabitsPage(todayPage)
          const names = Object.keys(todayPage.properties).filter(k => todayPage.properties[k].type === 'checkbox')
          setHabitNames(names)
        }
      } catch (e) { console.error(e) }
    } finally {
      setLoading(false)
    }
  }

  async function fetchPrices() {
    try {
      const r1 = await fetch(`${BACKEND}/api/exchange-rates`)
      const d1 = await r1.json()
      setRates(d1.rates || {})

      const symbols = new Set()
      if (investments.some(i => i.type?.startsWith('GOLD_'))) symbols.add('XAU/USD')
      if (investments.some(i => i.type === 'SILVER_GRAM')) symbols.add('XAG/USD')
      investments.filter(i => i.type === 'CRYPTO' || i.type === 'STOCK').forEach(i => i.symbol && symbols.add(i.symbol))
      if (symbols.size > 0) {
        const r2 = await fetch(`${BACKEND}/api/quote?symbols=${encodeURIComponent([...symbols].join(','))}`)
        const d2 = await r2.json()
        setQuotes(d2)
      }
    } catch (e) { console.error(e) }
  }

  async function toggleTask(t) {
    await supabase.from('tasks').update({ completed: !t.completed }).eq('id', t.id)
    fetchAll()
  }

  async function toggleHabit(habitName, currentValue) {
    if (!habitsPage) return
    await fetch(`${BACKEND}/api/habits/${habitsPage.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property: habitName, value: !currentValue })
    })
    fetchAll()
  }

  async function fetchMail() {
    try {
      const r = await fetch(`${BACKEND}/api/gmail-summary`)
      const d = await r.json()
      setMailData(d)
    } catch (e) { console.error(e) }
  }
  useEffect(() => { fetchMail() }, [])

  // ----- Hesaplamalar -----
  // Görevler
  const todayTasks = tasks.filter(t => !t.deadline || t.deadline === todayStr || (!t.completed && t.deadline < todayStr))
  const todayTasksDone = todayTasks.filter(t => t.completed).length
  const todayTasksTotal = todayTasks.length
  const openTasks = todayTasks.filter(t => !t.completed).slice(0, 5)

  // Alışkanlıklar
  const habitsDone = habitsPage ? habitNames.filter(n => habitsPage.properties[n]?.checkbox).length : 0
  const habitsTotal = habitNames.length

  // Kalori
  const totalCal = foodEntries.reduce((s, e) => s + Number(e.calories), 0)
  const calGoal = calorieGoal?.daily_calories || 2000
  const calPercent = Math.min((totalCal / calGoal) * 100, 100)

  // Harcama
  const todayExp = dailyExpenses.filter(e => e.date === todayStr).reduce((s, e) => s + Number(e.amount), 0)
  const totalIncome = income ? Number(income.amount) : 0
  const currentDay = today.getDate()
  const totalRecurring = recurringExpenses.filter(e => !e.due_day || e.due_day >= currentDay || e.due_day < 5).reduce((s, e) => s + Number(e.amount), 0)
  const totalVariable = variableBudgets.reduce((s, e) => s + Number(e.amount), 0)
  const baseAmount = income?.balance ? Number(income.balance) : totalIncome
  const remainingDays = (() => {
    if (currentDay <= 5) return 5 - currentDay + 1
    const next5 = new Date(today.getFullYear(), today.getMonth() + 1, 5)
    const td = new Date(today.getFullYear(), today.getMonth(), currentDay)
    return Math.round((next5 - td) / (1000 * 60 * 60 * 24)) + 1
  })()
  const dailyBudget = baseAmount > 0 ? Math.round((baseAmount - totalRecurring - totalVariable) / remainingDays) : 0
  const expPercent = dailyBudget > 0 ? Math.min((todayExp / dailyBudget) * 100, 100) : 0

  // Portföy
  function getTRYValue(inv) {
    const qty = Number(inv.quantity)
    const usdTry = rates.TRY || 0
    if (inv.type === 'TRY') return qty
    if (inv.type === 'USD') return qty * usdTry
    if (inv.type === 'EUR') return rates.EUR ? qty * (usdTry / rates.EUR) : 0
    if (inv.type === 'GBP') return rates.GBP ? qty * (usdTry / rates.GBP) : 0
    if (inv.type === 'SILVER_GRAM') {
      const xag = parseFloat(quotes['XAG/USD']?.close || 0)
      return (qty / 31.1035) * xag * usdTry
    }
    if (inv.type?.startsWith('GOLD_')) {
      const xau = parseFloat(quotes['XAU/USD']?.close || 0)
      const grams = inv.type === 'GOLD_GRAM' ? qty : qty * (GOLD_GRAMS[inv.type] || 0)
      return (grams / 31.1035) * xau * usdTry
    }
    if (inv.type === 'CRYPTO' || inv.type === 'STOCK') {
      const usdPrice = parseFloat(quotes[inv.symbol]?.close || 0)
      return qty * usdPrice * usdTry
    }
    return 0
  }
  const portfolioTotal = investments.reduce((s, i) => s + getTRYValue(i), 0)

  // Portföy günlük değişim (ağırlıklı)
  let weightedChange = 0, totalWithPrice = 0
  investments.forEach(i => {
    let change = null
    if (i.type === 'CRYPTO' || i.type === 'STOCK') change = parseFloat(quotes[i.symbol]?.percent_change || 0)
    else if (i.type === 'SILVER_GRAM') change = parseFloat(quotes['XAG/USD']?.percent_change || 0)
    else if (i.type?.startsWith('GOLD_')) change = parseFloat(quotes['XAU/USD']?.percent_change || 0)
    if (change !== null && !isNaN(change)) {
      const val = getTRYValue(i)
      weightedChange += change * val
      totalWithPrice += val
    }
  })
  const portfolioChange = totalWithPrice > 0 ? weightedChange / totalWithPrice : null

  if (loading) return <p style={{ color: 'var(--text-faint)' }}>Yükleniyor...</p>

  return (
    <div style={{ color: 'var(--text)' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>İyi günler, Furkan</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-faint)', margin: '4px 0 0' }}>
          {today.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Üst sıra — 5 küçük kart */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <StatCard
          to="/tasks"
          label="Bugünkü Görevler"
          value={`${todayTasksDone}/${todayTasksTotal}`}
          sub={todayTasksTotal - todayTasksDone > 0 ? `${todayTasksTotal - todayTasksDone} kalan` : 'Tamam'}
          percent={todayTasksTotal > 0 ? (todayTasksDone / todayTasksTotal) * 100 : 0}
          color="var(--accent)"
        />
        <StatCard
          to="/habits"
          label="Alışkanlıklar"
          value={habitsTotal > 0 ? `${habitsDone}/${habitsTotal}` : '—'}
          sub={habitsTotal > 0 ? (habitsDone === habitsTotal ? 'Hepsi tamam' : `${habitsTotal - habitsDone} kalan`) : 'Veri yok'}
          percent={habitsTotal > 0 ? (habitsDone / habitsTotal) * 100 : 0}
          color="var(--success)"
        />
        <StatCard
          to="/calories"
          label="Kalori"
          value={`${totalCal}`}
          sub={`/ ${calGoal} kcal`}
          percent={calPercent}
          color={calPercent > 100 ? 'var(--danger)' : calPercent > 85 ? 'var(--warning)' : 'var(--success)'}
        />
        <StatCard
          to="/finance"
          label="Bugünkü Harcama"
          value={`₺${todayExp.toLocaleString('tr-TR')}`}
          sub={`/ ₺${dailyBudget.toLocaleString('tr-TR')} limit`}
          percent={expPercent}
          color={expPercent > 80 ? 'var(--danger)' : expPercent > 50 ? 'var(--warning)' : 'var(--success)'}
        />
        <StatCard
          to="/finance"
          label="Portföy"
          value={portfolioChange !== null
            ? `${portfolioChange >= 0 ? '+' : ''}${portfolioChange.toFixed(2)}%`
            : '—'}
          valueColor={portfolioChange !== null ? (portfolioChange >= 0 ? 'var(--success)' : 'var(--danger)') : 'var(--text)'}
          sub={`₺${Math.round(portfolioTotal).toLocaleString('tr-TR')} toplam`}
        />
      </div>

      {/* Orta sıra — Görevler + Alışkanlıklar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Görevler */}
        <div style={cardStyle}>
          <CardHeader title="Bugünün Görevleri" to="/tasks" />
          {openTasks.length === 0 ? (
            <p style={emptyStyle}>Bugün için açık görev yok.</p>
          ) : (
            openTasks.map(t => (
              <div key={t.id} onClick={() => toggleTask(t)} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 0', borderBottom: '1px solid var(--border)',
                cursor: 'pointer'
              }}>
                <Circle size={16} color="var(--text-faint)" strokeWidth={2} />
                <span style={{ fontSize: '13.5px', color: 'var(--text-secondary)', flex: 1 }}>{t.title}</span>
                {t.deadline && t.deadline !== todayStr && (
                  <span style={{ fontSize: '11px', color: 'var(--danger)' }}>geçti</span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Alışkanlıklar */}
        <div style={cardStyle}>
          <CardHeader title="Bugünün Alışkanlıkları" to="/habits" />
          {!habitsPage ? (
            <p style={emptyStyle}>Bu ay için veri yok.</p>
          ) : (
            habitNames.map(name => {
              const checked = habitsPage.properties[name]?.checkbox || false
              return (
                <div key={name} onClick={() => toggleHabit(name, checked)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 0', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer'
                }}>
                  {checked ? <CheckCircle2 size={16} color="var(--success)" strokeWidth={2.2} /> : <Circle size={16} color="var(--text-faint)" strokeWidth={2} />}
                  <span style={{
                    fontSize: '13.5px',
                    color: checked ? 'var(--success)' : 'var(--text-secondary)',
                    textDecoration: checked ? 'line-through' : 'none',
                    flex: 1
                  }}>{name}</span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Alt — Mail durumu */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Mail</div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            {mailData?.connected === false ? 'Henüz Gmail bağlı değil' :
             mailData?.mails ? `Bugün ${mailData.mails.length} mail geldi` :
             'Mail durumu yükleniyor...'}
          </div>
        </div>
        <Link to="/mail" style={{
          padding: '8px 14px', borderRadius: '8px',
          background: 'var(--accent)', color: '#fff',
          textDecoration: 'none', fontSize: '13px', fontWeight: '500',
          display: 'flex', alignItems: 'center', gap: '6px'
        }}>
          Özeti gör <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}

function StatCard({ to, label, value, sub, percent, color, valueColor }) {
  return (
    <Link to={to || '/'} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '16px',
        transition: 'border-color 0.15s'
      }}>
        <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>{label}</div>
        <div style={{ fontSize: '22px', fontWeight: '700', color: valueColor || 'var(--text)', marginBottom: '4px' }}>{value}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginBottom: percent !== undefined ? '10px' : '0' }}>{sub}</div>
        {percent !== undefined && (
          <div style={{ background: 'var(--bg-item)', borderRadius: '99px', height: '4px' }}>
            <div style={{ width: `${percent}%`, height: '4px', borderRadius: '99px', background: color, transition: 'width 0.3s' }} />
          </div>
        )}
      </div>
    </Link>
  )
}

function CardHeader({ title, to }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '600' }}>{title}</div>
      <Link to={to} style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
        Tümü <ArrowRight size={12} />
      </Link>
    </div>
  )
}

const cardStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '16px'
}
const emptyStyle = {
  fontSize: '13px',
  color: 'var(--text-faint)',
  margin: '8px 0'
}

export default Home