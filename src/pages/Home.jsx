import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BACKEND } from '../config'
import { useAuth } from '../components/AuthProvider'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import { getBaseCurrencyValue, getDailyChange as calcDailyChange, getCurrentPeriod, isDueInCurrentCycle as isDue } from '../utils/finance'
import { formatMoney, progressSummary, budgetSummary } from '../utils/format'
import { usePreferences } from '../components/PreferencesProvider'
import { useTranslation } from 'react-i18next'

function Home() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'tr-TR'
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const currentMonth = todayStr.slice(0, 7)

  const [tasks, setTasks] = useState([])
  const [habits, setHabits] = useState([])
  const [todayLogs, setTodayLogs] = useState([])
  const [foodEntries, setFoodEntries] = useState([])
  const [calorieGoal, setCalorieGoal] = useState(null)
  const [dailyExpenses, setDailyExpenses] = useState([])
  const [recurringExpenses, setRecurringExpenses] = useState([])
  const [variableBudgets, setVariableBudgets] = useState([])
  const [income, setIncome] = useState(null)
  const [investments, setInvestments] = useState([])
  const [payday, setPayday] = useState(5)
  const [rates, setRates] = useState({})
  const [quotes, setQuotes] = useState({})
  const [mailData, setMailData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) fetchAll() }, [user])
  useEffect(() => { if (investments.length > 0) fetchPrices() }, [investments])
  useEffect(() => { if (user) fetchMail() }, [user])

  async function fetchAll() {
    try {
      const [t, h, hl, daily, recurring, variable, inv, inc, food, goal, settings] = await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', user.id),
        supabase.from('habits').select('*').eq('user_id', user.id).order('position', { ascending: true }),
        supabase.from('habit_logs').select('*').eq('user_id', user.id).eq('date', todayStr),
        supabase.from('daily_expenses').select('*').eq('user_id', user.id),
        supabase.from('recurring_expenses').select('*').eq('user_id', user.id),
        supabase.from('variable_budgets').select('*').eq('user_id', user.id),
        supabase.from('investments').select('*').eq('user_id', user.id),
        supabase.from('income').select('*').eq('user_id', user.id).eq('month', currentMonth).maybeSingle(),
        supabase.from('food_entries').select('*').eq('user_id', user.id).eq('date', todayStr),
        supabase.from('calorie_goals').select('*').eq('user_id', user.id).limit(1).maybeSingle(),
        supabase.from('user_settings').select('*').eq('user_id', user.id).eq('key', 'payday').maybeSingle()
      ])
      if (!t.error) setTasks(t.data)
      if (!h.error) setHabits(h.data)
      if (!hl.error) setTodayLogs(hl.data)
      if (!daily.error) setDailyExpenses(daily.data)
      if (!recurring.error) setRecurringExpenses(recurring.data)
      if (!variable.error) setVariableBudgets(variable.data)
      if (!inv.error) setInvestments(inv.data)
      if (!inc.error && inc.data) setIncome(inc.data)
      if (!food.error) setFoodEntries(food.data)
      if (!goal.error && goal.data) setCalorieGoal(goal.data)
      if (!settings.error && settings.data) setPayday(Number(settings.data.value) || 5)
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
      investments.filter(i => i.type === 'CRYPTO' || i.type === 'STOCK' || i.type === 'BIST').forEach(i => i.symbol && symbols.add(i.symbol))
      if (symbols.size > 0) {
        const r2 = await fetch(`${BACKEND}/api/quote?symbols=${encodeURIComponent([...symbols].join(','))}`)
        const d2 = await r2.json()
        setQuotes(d2)
      }
    } catch (e) { console.error(e) }
  }

  async function toggleTask(t) {
    const newStatus = t.status === 'done' ? 'todo' : 'done'
    await supabase.from('tasks').update({ status: newStatus }).eq('id', t.id).eq('user_id', user.id)
    fetchAll()
  }

  async function toggleHabit(habitId, isDone) {
    if (isDone) {
      await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', todayStr).eq('user_id', user.id)
    } else {
      await supabase.from('habit_logs').insert({
        habit_id: habitId, date: todayStr, done: true, user_id: user.id
      })
    }
    fetchAll()
  }

  async function fetchMail() {
  if (!user) return
  try {
    const r = await fetch(`${BACKEND}/api/gmail-summary?user_id=${user.id}`)
    const d = await r.json()
    setMailData(d)
  } catch (e) { console.error(e) }
}

  // ----- Hesaplamalar -----
  // Görevler
  const todayTasks = tasks.filter(t => !t.day || t.day === todayStr || (t.status !== 'done' && t.day < todayStr))
  const todayTasksDone = todayTasks.filter(t => t.status === 'done').length
  const todayTasksTotal = todayTasks.length
  const openTasks = todayTasks.filter(t => t.status !== 'done').slice(0, 5)

  // Alışkanlıklar
  const isHabitDone = id => todayLogs.some(l => l.habit_id === id && l.done)
  const habitsDone = habits.filter(h => isHabitDone(h.id)).length
  const habitsTotal = habits.length
  const visibleHabits = habits.slice(0, 6)

  // Kalori
  const totalCal = foodEntries.reduce((s, e) => s + Number(e.calories), 0)
  const calGoal = calorieGoal?.daily_calories || 2000
  const calPercent = Math.min((totalCal / calGoal) * 100, 100)

  // Harcama
  const todayExp = dailyExpenses.filter(e => e.date === todayStr).reduce((s, e) => s + Number(e.amount), 0)
  const totalIncome = income ? Number(income.amount) : 0
  const currentDay = today.getDate()
  const currentPeriod = getCurrentPeriod(payday)
  // Sabit giderler: sadece bu dönemde ödenecekler (Finance ile aynı mantık)
  const totalRecurring = recurringExpenses.filter(e => isDue(e.due_day, currentDay, payday)).reduce((s, e) => s + Number(e.amount), 0)
  // Değişken giderler: kalıcı (is_recurring && active) VEYA bu döneme özel (month === currentPeriod)
  const totalVariable = variableBudgets
    .filter(e => (e.is_recurring && e.active !== false) || e.month === currentPeriod)
    .reduce((s, e) => s + Number(e.amount), 0)
  const baseAmount = income?.balance ? Number(income.balance) : totalIncome
  const remainingDays = (() => {
    if (currentDay <= payday) return payday - currentDay + 1
    const nextPay = new Date(today.getFullYear(), today.getMonth() + 1, payday)
    const td = new Date(today.getFullYear(), today.getMonth(), currentDay)
    return Math.round((nextPay - td) / (1000 * 60 * 60 * 24)) + 1
  })()
  const dailyBudget = baseAmount > 0 ? Math.round((baseAmount - totalRecurring - totalVariable) / remainingDays) : 0
  const expPercent = dailyBudget > 0 ? Math.min((todayExp / dailyBudget) * 100, 100) : 0

  // Portföy — baseCurrency şimdilik sabit 'TRY' (Finance ile aynı yaklaşım)
  const { baseCurrency } = usePreferences()
  const fmt = (v) => formatMoney(v, baseCurrency)
  function getTRYValue(inv) {
    return getBaseCurrencyValue(inv, baseCurrency, rates, quotes, {})
  }
  const portfolioTotal = investments.reduce((s, i) => s + getTRYValue(i), 0)

  let weightedChange = 0, totalWithPrice = 0
  investments.forEach(i => {
    const change = calcDailyChange(i, quotes, {})
    if (change !== null && !isNaN(change)) {
      const val = getTRYValue(i)
      weightedChange += change * val
      totalWithPrice += val
    }
  })
  const portfolioChange = totalWithPrice > 0 ? weightedChange / totalWithPrice : null

  if (loading) return <p style={{ color: 'var(--text-faint)' }}>Yükleniyor...</p>

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Furkan'

  return (
    <div style={{ color: 'var(--text)' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>{t('home.greeting', { name: firstName })}</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-faint)', margin: '4px 0 0' }}>
          {today.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <StatCard
          to="/tasks"
          label={t('home.todaysTasks')}
          value={`${todayTasksDone}/${todayTasksTotal}`}
          sub={todayTasksTotal - todayTasksDone > 0 ? `${todayTasksTotal - todayTasksDone} kalan` : 'Tamam'}
          percent={todayTasksTotal > 0 ? (todayTasksDone / todayTasksTotal) * 100 : 0}
          color="var(--accent)"
        />
        <StatCard
          to="/habits"
          label={t('home.habits')}
          value={habitsTotal > 0 ? `${habitsDone}/${habitsTotal}` : '—'}
          sub={habitsTotal > 0 ? (habitsDone === habitsTotal ? t('home.allDone') : `${habitsTotal - habitsDone} ${t('common.remaining')}`) : t('common.none')}
          percent={habitsTotal > 0 ? (habitsDone / habitsTotal) * 100 : 0}
          color="var(--success)"
        />
        <StatCard
          to="/calories"
          label={t('home.calories')}
          value={`${totalCal}`}
          sub={calGoal > 0 ? (totalCal <= calGoal ? `${t('common.remaining')} ${(calGoal - totalCal).toLocaleString(locale)}` : `${(totalCal - calGoal).toLocaleString(locale)} ${t('common.over')}`) : `${totalCal} kcal`}
          percent={calPercent}
          color={calPercent > 100 ? 'var(--danger)' : calPercent > 85 ? 'var(--warning)' : 'var(--success)'}
        />
        <StatCard
          to="/finance"
          label={t('home.todaySpending')}
          value={fmt(todayExp)}
          sub={dailyBudget > 0 ? (todayExp <= dailyBudget ? `${fmt(dailyBudget - todayExp)} ${t('common.remaining')}` : `${fmt(todayExp - dailyBudget)} ${t('common.over')}`) : t('common.noLimit')}
          percent={expPercent}
          color={expPercent > 80 ? 'var(--danger)' : expPercent > 50 ? 'var(--warning)' : 'var(--success)'}
        />
        <StatCard
          to="/finance"
          label={t('home.portfolio')}
          value={portfolioChange !== null
          ? `${portfolioChange >= 0 ? '+' : ''}${portfolioChange.toFixed(2)}%`
          : '—'}
          valueColor={portfolioChange !== null ? (portfolioChange >= 0 ? 'var(--success)' : 'var(--danger)') : 'var(--text)'}
          sub={portfolioChange !== null && portfolioTotal > 0
          ? `${portfolioChange >= 0 ? '+' : ''}${fmt(Math.round(portfolioTotal * portfolioChange / 100))} ${t('home.todaySuffix')}`
          : ''}
          />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={cardStyle}>
          <CardHeader title={t('home.tasksToday')} to="/tasks" />
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
                {t.day && t.day < todayStr && (
                  <span style={{ fontSize: '11px', color: 'var(--danger)' }}>geçti</span>
                )}
              </div>
            ))
          )}
        </div>

        <div style={cardStyle}>
          <CardHeader title={t('home.habitsToday')} to="/habits" />
          {habits.length === 0 ? (
            <p style={emptyStyle}>Henüz alışkanlık eklenmedi.</p>
          ) : (
            visibleHabits.map(h => {
              const checked = isHabitDone(h.id)
              return (
                <div key={h.id} onClick={() => toggleHabit(h.id, checked)} style={{
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
                  }}>{h.name}</span>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Mail</div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            {mailData?.connected === false ? t('home.noGmail') :
             mailData?.mails ? t('home.mailCount', { count: mailData.mails.length }) :
             t('home.mailLoading')}
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