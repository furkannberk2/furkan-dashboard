import { useAuth } from '../components/AuthProvider'
import { readCachedQuotes, fetchMissingQuotes, staleAllQuotes } from '../lib/quoteCache'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BACKEND } from '../config'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip } from 'recharts'
import { getBaseCurrencyValue, getDailyChange as calcDailyChange, isDueInCurrentCycle as isDue, getRemainingDays as calcRemainingDays, getCurrentPeriod, getNextDueDate, daysUntilDue } from '../utils/finance'
import { formatMoney } from '../utils/format'
import { usePreferences } from '../components/PreferencesProvider'
import { useTranslation } from 'react-i18next'

const EXPENSE_CATEGORIES = [
  { key: 'groceries', label: 'Market' },
  { key: 'food', label: 'Yemek' },
  { key: 'transport', label: 'Ulaşım' },
  { key: 'cafe', label: 'Kafe' },
  { key: 'clothing', label: 'Giyim' },
  { key: 'health', label: 'Sağlık' },
  { key: 'entertainment', label: 'Eğlence' },
  { key: 'other', label: 'Diğer' },
]
const RECURRING_CATEGORIES = [
  { key: 'rent', label: 'Kira' },
  { key: 'bills', label: 'Fatura' },
  { key: 'debt', label: 'Borç' },
  { key: 'subscription', label: 'Abonelik' },
  { key: 'other', label: 'Diğer' },
]
const catLabel = (key) => {
  const all = [...EXPENSE_CATEGORIES, ...RECURRING_CATEGORIES]
  return all.find(c => c.key === key)?.label || key
}
const LOCATIONS = ['Fiziksel', 'Vakıfbank', 'Yapı Kredi', 'Midas']

const ASSET_TYPES = [
  { key: 'TRY', name: 'TL Nakit', unit: '₺', category: 'Para' },
  { key: 'USD', name: 'Dolar', unit: '$', category: 'Para' },
  { key: 'EUR', name: 'Euro', unit: '€', category: 'Para' },
  { key: 'GBP', name: 'Sterlin', unit: '£', category: 'Para' },
  { key: 'GOLD_GRAM', name: 'Gram Altın', unit: 'gr', category: 'Altın' },
  { key: 'GOLD_QUARTER', name: 'Çeyrek Altın', unit: 'adet', category: 'Altın' },
  { key: 'GOLD_HALF', name: 'Yarım Altın', unit: 'adet', category: 'Altın' },
  { key: 'GOLD_FULL', name: 'Tam Altın', unit: 'adet', category: 'Altın' },
  { key: 'SILVER_GRAM', name: 'Gram Gümüş', unit: 'gr', category: 'Gümüş' },
  { key: 'CRYPTO', name: 'Kripto', unit: 'adet', category: 'Kripto', needsSymbol: true },
  { key: 'STOCK', name: 'ABD Hisse', unit: 'adet', category: 'Hisse', needsSymbol: true },
  { key: 'BIST', name: 'BIST Hisse', unit: 'adet', category: 'Hisse', needsSymbol: true },
  { key: 'TEFAS_FUND', name: 'TEFAS Fonu', unit: 'pay', category: 'Fon', needsSymbol: true, manualCode: true },
]

const CATEGORY_COLORS = {
  'TL Nakit': '#60a5fa',
  'Dolar': '#22c55e',
  'Euro': '#3b82f6',
  'Sterlin': '#8b5cf6',
  'Altın': '#fbbf24',
  'Gram Gümüş': '#94a3b8',
  'Kripto': '#a78bfa',
  'ABD Hisse': '#6ee7b7',
  'BIST Hisse': '#f472b6',
  'TEFAS Fonu': '#fb923c'
}

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth <= 768)
  useEffect(() => {
    const h = () => setM(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}

function getMonthLabel(offset, locale = 'tr-TR') {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
}



function Finance() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState('daily')
  const [payday, setPayday] = useState(5)
  const [dailyExpenses, setDailyExpenses] = useState([])
  const [recurringExpenses, setRecurringExpenses] = useState([])
  const [variableBudgets, setVariableBudgets] = useState([])
  const [investments, setInvestments] = useState([])
  const [income, setIncome] = useState(null)
  const [paidStatus, setPaidStatus] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})

  const [rates, setRates] = useState({})
  const [quotes, setQuotes] = useState({})
  const [tefasQuotes, setTefasQuotes] = useState({})

  const [showAddInv, setShowAddInv] = useState(false)
  const [invAssetType, setInvAssetType] = useState(null)
  const [invSearch, setInvSearch] = useState('')
  const [invResults, setInvResults] = useState([])
  const [invSearching, setInvSearching] = useState(false)
  const [invSelectedSymbol, setInvSelectedSymbol] = useState(null)
  const [invManualCode, setInvManualCode] = useState('')
  const [invManualPreview, setInvManualPreview] = useState(null)
  const [invManualChecking, setInvManualChecking] = useState(false)
  const [invQty, setInvQty] = useState('')
  const [invLocation, setInvLocation] = useState('Fiziksel')

  const [newAmount, setNewAmount] = useState('')
  const [newCategory, setNewCategory] = useState('groceries')
  const [newDesc, setNewDesc] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [rName, setRName] = useState('')
  const [rCategory, setRCategory] = useState('bills')
  const [showPast, setShowPast] = useState(false)
  const [rAmount, setRAmount] = useState('')
  const [rDueDay, setRDueDay] = useState('')
  const [vName, setVName] = useState('')
  const [vAmount, setVAmount] = useState('')
  const [vRecurring, setVRecurring] = useState(null) // null=seçilmedi, true=kalıcı, false=aya özel
  const [incomeInput, setIncomeInput] = useState('')
  const [balanceInput, setBalanceInput] = useState('')
  const [useBalance, setUseBalance] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const currentMonth = today.slice(0, 7)
  const currentPeriod = getCurrentPeriod(payday)
  const remainingDays = calcRemainingDays(payday)
  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (investments.length > 0) fetchPrices() }, [investments])

async function fetchAll() {
    const [daily, recurring, variable, inv, inc, settings] = await Promise.all([
      supabase.from('daily_expenses').select('*').order('date', { ascending: false }),
      supabase.from('recurring_expenses').select('*').order('due_day', { ascending: true }),
      supabase.from('variable_budgets').select('*'),
      supabase.from('investments').select('*'),
      supabase.from('income').select('*').eq('month', currentMonth).maybeSingle(),
      supabase.from('user_settings').select('*').eq('key', 'payday').maybeSingle()
    ])
    if (!daily.error) setDailyExpenses(daily.data)
    if (!recurring.error) setRecurringExpenses(recurring.data)
    if (!variable.error) setVariableBudgets(variable.data)
    if (!inv.error) setInvestments(inv.data)
    if (!inc.error && inc.data) {
      setIncome(inc.data)
      setIncomeInput(inc.data.amount)
      if (inc.data.balance) { setBalanceInput(inc.data.balance); setUseBalance(true) }
    } else {
      // Yeni ay: form temiz açılsın
      setIncome(null)
      setIncomeInput('')
      setBalanceInput('')
      setUseBalance(false)
    }
    if (!settings.error && settings.data) setPayday(Number(settings.data.value) || 5)
  }

async function fetchPrices(forceRefresh = false) {
    try {
      const r1 = await fetch(`${BACKEND}/api/exchange-rates`)
      const d1 = await r1.json()
      setRates(d1.rates || {})

      const yahooSymbols = new Set()
      const bistSymbols = new Set()

      if (investments.some(i => i.type?.startsWith('GOLD_'))) yahooSymbols.add('XAU/USD')
      if (investments.some(i => i.type === 'SILVER_GRAM')) yahooSymbols.add('XAG/USD')
      investments.filter(i => i.type === 'CRYPTO' || i.type === 'STOCK').forEach(i => i.symbol && yahooSymbols.add(i.symbol))
      investments.filter(i => i.type === 'BIST').forEach(i => i.symbol && bistSymbols.add(i.symbol))

      if (forceRefresh) staleAllQuotes()

      const allForCache = [...yahooSymbols, ...bistSymbols]
      const bistList = [...bistSymbols]

      if (allForCache.length > 0) {
        setQuotes(readCachedQuotes(allForCache))
        fetchMissingQuotes(allForCache, (updated) => setQuotes(updated), bistList)
      }

      const tefasCodes = investments.filter(i => i.type === 'TEFAS_FUND').map(i => i.symbol).filter(Boolean)
      if (tefasCodes.length > 0) {
        const r2 = await fetch(`${BACKEND}/api/tefas-fund?codes=${encodeURIComponent(tefasCodes.join(','))}`)
        const d2 = await r2.json()
        setTefasQuotes(d2)
      }
    } catch (err) { console.error(err) }
  }

  // baseCurrency şimdilik sabit 'TRY' — user_preferences bağlanınca dinamik olacak.
  // getBaseCurrencyValue('TRY') eski getTRYValue ile birebir aynı sonucu verir.
  const { baseCurrency } = usePreferences()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'tr-TR'
  // Kategori ve varlık label'ları çeviriden (global catLabel yerine)
  const catLabelT = (key) => t('categories.' + key, { defaultValue: key })
  const assetName = (key) => t('assetNames.' + key, { defaultValue: key })
  const assetCatT = (cat) => t('assetCategories.' + cat, { defaultValue: cat })
  const fmt = (v) => formatMoney(v, baseCurrency)
  function getTRYValue(inv) {
    return getBaseCurrencyValue(inv, baseCurrency, rates, quotes, tefasQuotes)
  }

  function getDailyChange(inv) {
    return calcDailyChange(inv, quotes, tefasQuotes)
  }

  async function searchInvSymbol() {
    if (!invSearch.trim() || !invAssetType?.needsSymbol) return
    setInvSearching(true)
    try {
      const apiType = invAssetType.key === 'CRYPTO' ? 'crypto' : invAssetType.key === 'BIST' ? 'bist' : 'stock'
      const res = await fetch(`${BACKEND}/api/symbol-search?q=${encodeURIComponent(invSearch)}&type=${apiType}`)
      const data = await res.json()
      setInvResults(data.results || [])
    } catch (err) { console.error(err) }
    finally { setInvSearching(false) }
  }

  async function checkTefasCode() {
    if (!invManualCode.trim()) return
    setInvManualChecking(true)
    setInvManualPreview(null)
    try {
      const code = invManualCode.trim().toUpperCase()
      const res = await fetch(`${BACKEND}/api/tefas-fund?codes=${encodeURIComponent(code)}`)
      const data = await res.json()
      const entry = data[code]
      if (entry && entry.close > 0) {
        setInvManualPreview({ code, name: entry.name, price: entry.close })
      } else {
        setInvManualPreview({ error: t('finance.fundNotFound') })
      }
    } catch (err) {
      setInvManualPreview({ error: err.message })
    } finally {
      setInvManualChecking(false)
    }
  }

  async function addInvestment() {
    if (!invAssetType || !invQty) return
    let symbol, name
    if (invAssetType.manualCode) {
      if (!invManualPreview || invManualPreview.error) return
      symbol = invManualPreview.code
      name = invManualPreview.name
    } else if (invAssetType.needsSymbol) {
      if (!invSelectedSymbol) return
      symbol = invSelectedSymbol.symbol
      name = invSelectedSymbol.instrument_name || invSelectedSymbol.symbol
    } else {
      symbol = invAssetType.key
      name = assetName(invAssetType.key)
    }
    await supabase.from('investments').insert({
      symbol, name, type: invAssetType.key,
      quantity: Number(invQty), location: invLocation, user_id: user.id
    })
    setShowAddInv(false)
    setInvAssetType(null); setInvSelectedSymbol(null); setInvSearch(''); setInvResults([])
    setInvManualCode(''); setInvManualPreview(null)
    setInvQty(''); setInvLocation('Fiziksel')
    fetchAll()
  }

  async function deleteInvestment(id) {
    await supabase.from('investments').delete().eq('id', id)
    fetchAll()
  }

  function startEdit(item, type) {
    setEditingId(item.id)
    if (type === 'recurring') setEditData({ name: item.name, category: item.category, amount: item.amount, due_day: item.due_day || '' })
    if (type === 'variable') setEditData({ name: item.name, amount: item.amount })
    if (type === 'investment') setEditData({ quantity: item.quantity, location: item.location })
    if (type === 'daily') setEditData({ description: item.description || '', category: item.category, amount: item.amount, date: item.date })
  }

  async function saveEdit(type) {
    if (type === 'recurring') {
      await supabase.from('recurring_expenses').update({
        name: editData.name, category: editData.category,
        amount: Number(editData.amount), due_day: editData.due_day ? Number(editData.due_day) : null
      }).eq('id', editingId)
    }
    if (type === 'variable') {
      await supabase.from('variable_budgets').update({ name: editData.name, amount: Number(editData.amount) }).eq('id', editingId)
    }
    if (type === 'investment') {
      await supabase.from('investments').update({ quantity: Number(editData.quantity), location: editData.location, updated_at: new Date() }).eq('id', editingId)
    }
    if (type === 'daily') {
      await supabase.from('daily_expenses').update({
        description: editData.description || null, category: editData.category,
        amount: Number(editData.amount), date: editData.date
      }).eq('id', editingId)
    }
    setEditingId(null); setEditData({})
    fetchAll()
  }
  async function savePayday(value) {
    const num = Math.min(31, Math.max(1, Number(value) || 5))
    setPayday(num)
    await supabase.from('user_settings').upsert({ user_id: user.id, key: 'payday', value: String(num), updated_at: new Date() }, { onConflict: 'key' })
  }
  async function saveIncome() {
    if (!incomeInput) return
    const payload = { amount: Number(incomeInput), balance: useBalance && balanceInput ? Number(balanceInput) : null }
    if (income) await supabase.from('income').update(payload).eq('id', income.id)
    else await supabase.from('income').insert({ ...payload, month: currentMonth, user_id: user.id })
    fetchAll()
  }

  async function addDailyExpense() {
    if (!newAmount) return
    await supabase.from('daily_expenses').insert({ date: newDate, user_id: user.id, category: newCategory, description: newDesc || null, amount: Number(newAmount) })
    setNewAmount(''); setNewDesc(''); fetchAll()
  }

  async function addRecurring() {
    if (!rAmount || !rName) return
    await supabase.from('recurring_expenses').insert({ name: rName, user_id: user.id, category: rCategory, amount: Number(rAmount), due_day: rDueDay ? Number(rDueDay) : null })
    setRName(''); setRAmount(''); setRDueDay(''); fetchAll()
  }

  async function addVariableBudget() {
    if (!vAmount || !vName) return
    if (vRecurring === null) { alert(t('finance.selectRecurringType')); return }
    await supabase.from('variable_budgets').insert({
      user_id: user.id,
      month: currentPeriod,
      name: vName,
      amount: Number(vAmount),
      is_recurring: vRecurring,
      active: true
    })
    setVName(''); setVAmount(''); setVRecurring(null)
    fetchAll()
  }

  async function deleteDaily(id) { await supabase.from('daily_expenses').delete().eq('id', id); fetchAll() }
  async function deleteRecurring(id) { await supabase.from('recurring_expenses').delete().eq('id', id); fetchAll() }
  async function deleteVariable(id) { await supabase.from('variable_budgets').delete().eq('id', id); fetchAll() }

  const totalIncome = income ? Number(income.amount) : 0
  const currentDay = new Date().getDate()
  // YENİ MANTIK: Sadece bugünden bir sonraki maaş gününe kadar olan döneme düşen giderler hesaba katılır
  const totalRecurring = recurringExpenses
    .filter(e => isDue(e.due_day, currentDay, payday))
    .reduce((s, e) => s + Number(e.amount), 0)
  const totalRecurringFull = recurringExpenses.reduce((s, e) => s + Number(e.amount), 0)
  // Aktif değişken giderler: kalıcı (is_recurring && active) VEYA bu maaş dönemine özel (month === currentPeriod)
  const activeVariableBudgets = variableBudgets.filter(e =>
    (e.is_recurring && e.active !== false) || e.month === currentPeriod
  )
  const totalVariable = activeVariableBudgets.reduce((s, e) => s + Number(e.amount), 0)
  const baseAmount = useBalance && income?.balance ? Number(income.balance) : totalIncome
  const dailyBudget = baseAmount > 0 ? Math.round((baseAmount - totalRecurring - totalVariable) / remainingDays) : 0
  const todayTotal = dailyExpenses.filter(e => e.date === today).reduce((s, e) => s + Number(e.amount), 0)
  const monthTotal = dailyExpenses.filter(e => e.date.startsWith(currentMonth)).reduce((s, e) => s + Number(e.amount), 0)
  const limitPercent = dailyBudget > 0 ? Math.min((todayTotal / dailyBudget) * 100, 100) : 0
  const investTotal = investments.reduce((s, i) => s + getTRYValue(i), 0)

const categoryDistribution = (() => {
  const map = {}
  investments.forEach(i => {
    let colorKey, label
    if (i.type?.startsWith('GOLD_')) {
      colorKey = 'Altın'          // renk için sabit anahtar (Türkçe)
      label = assetCatT('Altın')  // gösterim için çevrili
    } else {
      const at = ASSET_TYPES.find(a => a.key === i.type)
      colorKey = at ? at.name : i.type   // sabit Türkçe isim (CATEGORY_COLORS anahtarı)
      label = at ? assetName(at.key) : i.type
    }
    if (!map[colorKey]) map[colorKey] = { value: 0, label }
    map[colorKey].value += getTRYValue(i)
  })
  return Object.entries(map)
    .map(([colorKey, o]) => ({ name: o.label, colorKey, value: Math.round(o.value) }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
})()

  const grouped = {}
  investments.forEach(i => {
    const key = i.type === 'CRYPTO' || i.type === 'STOCK' || i.type === 'BIST' || i.type === 'TEFAS_FUND' ? i.symbol : i.type
    if (!grouped[key]) {
      const at = ASSET_TYPES.find(a => a.key === i.type)
      grouped[key] = {
        key, type: i.type, symbol: i.symbol, name: i.name,
        displayName: at && !at.needsSymbol ? at.name : i.name,
        unit: at?.unit || 'adet',
        items: [], totalQty: 0, totalTRY: 0,
        dailyChange: getDailyChange(i)
      }
    }
    grouped[key].items.push(i)
    grouped[key].totalQty += Number(i.quantity)
    grouped[key].totalTRY += getTRYValue(i)
  })

  const usdTry = rates.TRY || 0
  const paidRecurring = recurringExpenses.filter(e => paidStatus[e.id])
  const unpaidRecurring = recurringExpenses.filter(e => !paidStatus[e.id])
  const monthlyFree = totalIncome - totalRecurringFull - totalVariable
  // Kalıcı değişken giderler toplamı (her ay devreder)
  const totalRecurringVariable = variableBudgets
    .filter(e => e.is_recurring && e.active !== false)
    .reduce((s, e) => s + Number(e.amount), 0)

  const projection = [0, 1, 2].map(offset => {
    // Bu ay: tüm aktif değişkenler (kalıcı + bu döneme özel)
    // Sonraki aylar: sadece kalıcı değişkenler devreder
    const variable = offset === 0 ? totalVariable : totalRecurringVariable
    const free = totalIncome - totalRecurringFull - variable
    return { label: getMonthLabel(offset, locale), income: totalIncome, recurring: totalRecurringFull, variable, free }
  })

  return (
    <div style={{ color: 'var(--text)' }}>
      <h2 style={{ marginBottom: '20px', fontSize: '22px', fontWeight: '700' }}>Finans</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <SummaryCard title={t('finance.todaySpending')} value={`${fmt(todayTotal)}`} sub={dailyBudget > 0 ? (todayTotal <= dailyBudget ? `${fmt(dailyBudget - todayTotal)} ${t('finance.remaining')} · ${t('finance.daysLeft', { days: remainingDays })}` : `${fmt(todayTotal - dailyBudget)} ${t('finance.over')}`) : `Limit: ${fmt(dailyBudget)}`} percent={limitPercent} color={limitPercent > 80 ? 'var(--danger)' : limitPercent > 50 ? 'var(--warning)' : 'var(--success)'} />
        <SummaryCard title="Bu Ay Harcama" value={`${fmt(monthTotal)}`} sub={`Gelir: ${fmt(totalIncome)}`} />
        <SummaryCard title={t('finance.investPortfolio')} value={`${fmt(Math.round(investTotal))}`} sub={`${investments.length} pozisyon${usdTry ? ` · 1$ = ${usdTry.toFixed(2)}₺` : ''}`} />
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['daily', 'recurring', 'variable', 'investments', 'income'].map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)} style={{
            padding: '6px 14px', borderRadius: '20px', border: '1px solid',
            borderColor: tab === tabKey ? 'var(--accent)' : 'var(--border-strong)',
            background: tab === tabKey ? 'var(--accent)' : 'transparent',
            color: tab === tabKey ? '#fff' : 'var(--text-dim)', fontSize: '12.5px', cursor: 'pointer'
          }}>
            {tabKey === 'daily' ? t('finance.daily') : tabKey === 'recurring' ? t('finance.fixed') : tabKey === 'variable' ? t('finance.variable') : tabKey === 'investments' ? t('finance.investment') : t('finance.income')}
          </button>
        ))}
      </div>

      {/* Günlük */}
      {tab === 'daily' && (
        <div style={{ maxWidth: '680px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder={t('finance.descriptionPlaceholder')} style={inputStyle} />
              <input value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder={`₺ ${t('finance.amountPlaceholder')}`} type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)} style={selectStyle}>
                {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{catLabelT(c.key)}</option>)}
              </select>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ ...inputStyle, flex: isMobile ? 1 : 0, width: isMobile ? 'auto' : '160px', minWidth: '140px', fontSize: '13px' }} />
              <button onClick={addDailyExpense} style={buttonStyle}>{t('common.add')}</button>
            </div>
          </div>
          {(() => {
            // Bir harcama satırını render eden yardımcı
            const renderExpense = (e) => editingId === e.id ? (
              <div key={e.id} style={{ background: 'var(--bg-soft)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <input value={editData.description} onChange={ev => setEditData(d => ({ ...d, description: ev.target.value }))} placeholder={t('finance.description')} style={inputStyle} />
                  <input value={editData.amount} onChange={ev => setEditData(d => ({ ...d, amount: ev.target.value }))} type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select value={editData.category} onChange={ev => setEditData(d => ({ ...d, category: ev.target.value }))} style={selectStyle}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{catLabelT(c.key)}</option>)}
                  </select>
                  <input type="date" value={editData.date} onChange={ev => setEditData(d => ({ ...d, date: ev.target.value }))} style={{ ...inputStyle, flex: 0, width: '160px' }} />
                  <button onClick={() => saveEdit('daily')} style={buttonStyle}>{t('common.save')}</button>
                  <button onClick={() => setEditingId(null)} style={{ ...buttonStyle, background: 'var(--bg-item)', color: 'var(--text-secondary)' }}>{t('common.cancel')}</button>
                </div>
              </div>
            ) : (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', background: 'var(--bg-card)', borderRadius: '6px', padding: '3px 8px', color: "var(--text-muted)", flexShrink: 0 }}>{catLabelT(e.category)}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description || '—'}</span>
                <span style={{ fontSize: '14px', color: 'var(--text)', fontWeight: '600', flexShrink: 0 }}>{fmt(Number(e.amount))}</span>
                <span onClick={() => startEdit(e, 'daily')} style={{ color: 'var(--text-dim)', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>✏️</span>
                <span onClick={() => deleteDaily(e.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>✕</span>
              </div>
            )

            const todayExpenses = dailyExpenses.filter(e => e.date === today)
            const pastExpenses = dailyExpenses.filter(e => e.date !== today)

            // Geçmişi tarihe göre grupla (en yeni üstte)
            const pastByDate = {}
            pastExpenses.forEach(e => { (pastByDate[e.date] = pastByDate[e.date] || []).push(e) })
            const pastDates = Object.keys(pastByDate).sort((a, b) => b.localeCompare(a))

            const dateLabel = (d) => new Date(d + 'T00:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })

            return (
              <>
                {/* Bugün */}
                <div style={{ fontSize: '12px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: '600' }}>{t('common.today')}</div>
                {todayExpenses.length > 0 ? todayExpenses.map(renderExpense)
                  : <p style={{ color: 'var(--text-faint)', fontSize: '14px', marginBottom: '16px' }}>{t('finance.noExpenseToday')}</p>}

                {/* Geçmiş harcamalar butonu */}
                {pastExpenses.length > 0 && (
                  <button onClick={() => setShowPast(v => !v)} style={{
                    width: '100%', padding: '11px', borderRadius: '10px', marginTop: '10px',
                    background: 'transparent', border: '1px dashed var(--border-strong)',
                    color: 'var(--text-dim)', fontSize: '13px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}>
                    {showPast ? t('finance.hidePast') : t('finance.showPast', { count: pastExpenses.length })}
                  </button>
                )}

                {/* Geçmiş — tarih tarih gruplı */}
                {showPast && pastDates.map(date => {
                  const dayTotal = pastByDate[date].reduce((s, e) => s + Number(e.amount), 0)
                  return (
                    <div key={date} style={{ marginTop: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: '600' }}>{dateLabel(date)}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{fmt(dayTotal)}</span>
                      </div>
                      {pastByDate[date].map(renderExpense)}
                    </div>
                  )
                })}

                {dailyExpenses.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>Harcama yok.</p>}
              </>
            )
          })()}
        </div>
      )}

      {/* Sabit Giderler */}
      {tab === 'recurring' && (
        <div style={{ maxWidth: '680px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <input value={rName} onChange={e => setRName(e.target.value)} placeholder={t('finance.namePlaceholderBill')} style={inputStyle} />
              <input value={rAmount} onChange={e => setRAmount(e.target.value)} placeholder={`₺ ${t('finance.amountPlaceholder')}`} type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select value={rCategory} onChange={e => setRCategory(e.target.value)} style={selectStyle}>
                {RECURRING_CATEGORIES.map(c => <option key={c.key} value={c.key}>{catLabelT(c.key)}</option>)}
              </select>
              <input value={rDueDay} onChange={e => setRDueDay(e.target.value)} placeholder={t('finance.dueDay')} type="number" min="1" max="31" style={{ ...inputStyle, flex: isMobile ? 1 : 0, width: isMobile ? 'auto' : '160px', minWidth: '120px', fontSize: '13px' }} />
              <button onClick={addRecurring} style={buttonStyle}>{t('common.add')}</button>
            </div>
          </div>
          {[...unpaidRecurring, ...paidRecurring].map(e => editingId === e.id ? (
            <div key={e.id} style={{ background: 'var(--bg-soft)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <input value={editData.name} onChange={ev => setEditData(d => ({ ...d, name: ev.target.value }))} placeholder={t('finance.name')} style={inputStyle} />
                <input value={editData.amount} onChange={ev => setEditData(d => ({ ...d, amount: ev.target.value }))} type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select value={editData.category} onChange={ev => setEditData(d => ({ ...d, category: ev.target.value }))} style={selectStyle}>
                  {RECURRING_CATEGORIES.map(c => <option key={c.key} value={c.key}>{catLabelT(c.key)}</option>)}
                </select>
                <input value={editData.due_day} onChange={ev => setEditData(d => ({ ...d, due_day: ev.target.value }))} placeholder={t('finance.dueDay')} type="number" min="1" max="31" style={{ ...inputStyle, flex: 0, width: '150px' }} />
                <button onClick={() => saveEdit('recurring')} style={buttonStyle}>{t('common.save')}</button>
                <button onClick={() => setEditingId(null)} style={{ ...buttonStyle, background: 'var(--bg-item)', color: 'var(--text-secondary)' }}>{t('common.cancel')}</button>
              </div>
            </div>
          ) : (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', opacity: paidStatus[e.id] ? 0.5 : 1, flexWrap: 'wrap' }}>
              <div onClick={() => setPaidStatus(p => ({ ...p, [e.id]: !p[e.id] }))} style={{ width: '18px', height: '18px', borderRadius: '5px', border: '2px solid', borderColor: paidStatus[e.id] ? 'var(--success)' : 'var(--text-faint)', background: paidStatus[e.id] ? 'var(--success)' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {paidStatus[e.id] && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <span style={{ fontSize: '11px', background: 'var(--bg-card)', borderRadius: '6px', padding: '3px 8px', color: "var(--text-muted)", flexShrink: 0 }}>{catLabelT(e.category)}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: '80px' }}>{e.name}</span>
              {e.due_day && !isMobile && (() => {
                const inCycle = isDue(e.due_day, currentDay, payday)
                const days = daysUntilDue(e.due_day)
                const nextDate = getNextDueDate(e.due_day)
                const dateStr = nextDate ? nextDate.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : ''
                // Uyarı: bu dönemde ödenecek VE 3 gün veya daha az kala VE ödenmemiş
                const warn = inCycle && !paidStatus[e.id] && days !== null && days <= 3
                return (
                  <span style={{ fontSize: '12px', color: warn ? 'var(--warning)' : 'var(--text-faint)', flexShrink: 0 }}>
                    {warn ? '⚠️ ' : '📅 '}{dateStr}{warn ? ` (${t('finance.daysLeft', { days })})` : ''}
                  </span>
                )
              })()}
              <span style={{ fontSize: '14px', color: 'var(--text)', fontWeight: '600', flexShrink: 0 }}>{fmt(Number(e.amount))}</span>
              <span onClick={() => startEdit(e, 'recurring')} style={{ color: 'var(--text-dim)', cursor: 'pointer', fontSize: '13px' }}>✏️</span>
              <span onClick={() => deleteRecurring(e.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '14px' }}>✕</span>
            </div>
          ))}
          {recurringExpenses.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>Sabit gider yok.</p>}
        </div>
      )}

      {/* Değişken Bütçe */}
      {tab === 'variable' && (
        <div style={{ maxWidth: '680px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <input value={vName} onChange={e => setVName(e.target.value)} placeholder={t('finance.namePlaceholderInvest')} style={inputStyle} />
              <input value={vAmount} onChange={e => setVAmount(e.target.value)} placeholder={`₺ ${t('finance.amountPlaceholder')}`} type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
              <button onClick={addVariableBudget} style={buttonStyle}>{t('common.add')}</button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setVRecurring(true)} style={{
                flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12.5px', cursor: 'pointer',
                border: '1px solid', borderColor: vRecurring === true ? 'var(--accent)' : 'var(--border-strong)',
                background: vRecurring === true ? 'var(--accent)' : 'transparent',
                color: vRecurring === true ? '#fff' : 'var(--text-dim)'
              }}>{t('finance.recurring')}</button>
              <button onClick={() => setVRecurring(false)} style={{
                flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12.5px', cursor: 'pointer',
                border: '1px solid', borderColor: vRecurring === false ? 'var(--accent)' : 'var(--border-strong)',
                background: vRecurring === false ? 'var(--accent)' : 'transparent',
                color: vRecurring === false ? '#fff' : 'var(--text-dim)'
              }}>{t('finance.periodOnly')}</button>
            </div>
          </div>
          {activeVariableBudgets.map(e => editingId === e.id ? (
            <div key={e.id} style={{ background: 'var(--bg-soft)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input value={editData.name} onChange={ev => setEditData(d => ({ ...d, name: ev.target.value }))} placeholder={t('finance.name')} style={inputStyle} />
                <input value={editData.amount} onChange={ev => setEditData(d => ({ ...d, amount: ev.target.value }))} type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
                <button onClick={() => saveEdit('variable')} style={buttonStyle}>{t('common.save')}</button>
                <button onClick={() => setEditingId(null)} style={{ ...buttonStyle, background: 'var(--bg-item)', color: 'var(--text-secondary)' }}>{t('common.cancel')}</button>
              </div>
            </div>
          ) : (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</span>
              {e.is_recurring && <span style={{ fontSize: '10px', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '4px', padding: '1px 5px', flexShrink: 0 }}>{t('finance.recurringBadge')}</span>}
              <span style={{ fontSize: '14px', color: 'var(--text)', fontWeight: '600' }}>{fmt(Number(e.amount))}</span>
              <span onClick={() => startEdit(e, 'variable')} style={{ color: 'var(--text-dim)', cursor: 'pointer', fontSize: '13px' }}>✏️</span>
              <span onClick={() => deleteVariable(e.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '14px' }}>✕</span>
            </div>
          ))}
          {activeVariableBudgets.length > 0 && (
            <div style={{ marginTop: '14px', padding: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '13px' }}>{t('finance.totalVariableBudget')}</span>
                <span style={{ color: 'var(--text)', fontWeight: '700' }}>{fmt(totalVariable)}</span>
              </div>
            </div>
          )}
          {activeVariableBudgets.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>{t('finance.noVariable')}</p>}
        </div>
      )}

      {/* Yatırımlar */}
      {tab === 'investments' && (
        <div style={{ maxWidth: '780px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-faint)', flex: 1, minWidth: '160px' }}>
              {usdTry ? `1$ = ${usdTry.toFixed(2)}₺ · 1€ = ${rates.EUR ? (usdTry / rates.EUR).toFixed(2) : '...'}₺` : t('finance.ratesLoading')}
            </div>
            <button onClick={() => fetchPrices(true)} style={{ ...buttonStyle, background: 'var(--bg-item)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '12px', padding: '5px 12px' }}>↻ Yenile</button>
            <button onClick={() => setShowAddInv(true)} style={{ ...buttonStyle, fontSize: '13px' }}>+ {t('common.add')}</button>
          </div>
          <PortfolioPie data={categoryDistribution} total={investTotal} isMobile={isMobile} baseCurrency={baseCurrency} t={t} />
          {Object.values(grouped).map(g => (
            <div key={g.key} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', gap: '8px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.displayName}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px' }}>
                    {t('finance.totalQty')} {g.totalQty.toLocaleString(locale, { maximumFractionDigits: 6 })} {g.unit}
                    {g.dailyChange !== null && !isNaN(g.dailyChange) && (
                      <span style={{ marginLeft: '8px', color: g.dailyChange >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {g.dailyChange >= 0 ? '+' : ''}{g.dailyChange.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '17px', fontWeight: '700', flexShrink: 0 }}>{fmt(Math.round(g.totalTRY))}</div>
              </div>

              {g.items.map(i => editingId === i.id ? (
                <div key={i.id} style={{ background: 'var(--bg-soft)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '10px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input value={editData.quantity} onChange={ev => setEditData(d => ({ ...d, quantity: ev.target.value }))} type="number" step="0.000001" style={{ ...inputStyle, flex: 1, minWidth: '120px' }} />
                    <select value={editData.location} onChange={ev => setEditData(d => ({ ...d, location: ev.target.value }))} style={selectStyle}>
                      {LOCATIONS.map(l => <option key={l} value={l}>{l === 'Fiziksel' ? t('finance.physical') : l}</option>)}
                    </select>
                    <button onClick={() => saveEdit('investment')} style={buttonStyle}>{t('common.save')}</button>
                    <button onClick={() => setEditingId(null)} style={{ ...buttonStyle, background: 'var(--bg-item)', color: 'var(--text-secondary)' }}>{t('common.cancel')}</button>
                  </div>
                </div>
              ) : (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', background: 'var(--bg-card)', borderRadius: '6px', padding: '3px 8px', color: 'var(--text-muted)', flexShrink: 0 }}>{i.location === 'Fiziksel' ? t('finance.physical') : i.location}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {Number(i.quantity).toLocaleString('tr-TR', { maximumFractionDigits: 6 })} {g.unit}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>{fmt(Math.round(getTRYValue(i)))}</span>
                  <span onClick={() => startEdit(i, 'investment')} style={{ color: 'var(--text-dim)', cursor: 'pointer', fontSize: '13px' }}>✏️</span>
                  <span onClick={() => deleteInvestment(i.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '13px' }}>✕</span>
                </div>
              ))}
            </div>
          ))}

          {investments.length === 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>{t('finance.noInvestment')}</p>
            </div>
          )}

          {investments.length > 0 && (
            <div style={{ marginTop: '14px', padding: '14px', background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600' }}>{t('finance.totalPortfolio')}</span>
              <span style={{ color: 'var(--text)', fontWeight: '700', fontSize: '18px' }}>{fmt(Math.round(investTotal))}</span>
            </div>
          )}
        </div>
      )}

      {/* Gelir & Projeksiyon */}
      {tab === 'income' && (
        <div style={{ maxWidth: '780px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>{currentMonth} — {t('finance.salaryDay')}</span>
              <input
                type="number" min="1" max="31"
                value={payday}
                onChange={e => savePayday(e.target.value)}
                style={{ ...inputStyle, flex: 0, width: '60px', padding: '5px 8px', fontSize: '13px', textAlign: 'center' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>{t('finance.everyMonth')}</span>
            </div>
            <input value={incomeInput} onChange={e => setIncomeInput(e.target.value)} placeholder={t('finance.monthlySalaryPlaceholder')} type="number" style={{ ...inputStyle, width: '100%', marginBottom: '8px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div onClick={() => setUseBalance(!useBalance)} style={{ width: '18px', height: '18px', borderRadius: '5px', border: '2px solid', borderColor: useBalance ? 'var(--accent)' : 'var(--text-faint)', background: useBalance ? 'var(--accent)' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {useBalance && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('finance.useBalance')}</span>
            </div>
            {useBalance && (
              <input value={balanceInput} onChange={e => setBalanceInput(e.target.value)} placeholder="₺ Mevcut bakiye" type="number" style={{ ...inputStyle, width: '100%', marginBottom: '8px' }} />
            )}
            <button onClick={saveIncome} style={buttonStyle}>{t('common.save')}</button>
          </div>

          {totalIncome > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Bu Ay</div>
              <Row label={t('finance.monthlySalary')} value={`${fmt(totalIncome)}`} color="var(--success)" />
              {useBalance && income?.balance && (
                <Row label={t('finance.currentBalance')} value={`${fmt(Number(income.balance))}`} color="var(--purple)" />
              )}
              <Row label={t('finance.fixedExpenses')} value={`− ${fmt(totalRecurring)}`} color="var(--danger)" />
              <Row label={t('finance.variableBudget')} value={`− ${fmt(totalVariable)}`} color="var(--warning)" />
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '4px' }}>
                <Row label={t('finance.availableBudget')} value={`${fmt((baseAmount - totalRecurring - totalVariable))}`} bold />
                <Row label={t('finance.dailyLimit', { days: remainingDays })} value={`${fmt(dailyBudget)}`} color="var(--accent)" bold large />
              </div>
            </div>
          )}

          {totalIncome > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>{t('finance.projection3m')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                {projection.map((p, i) => (
                  <div key={i} style={{ background: i === 0 ? 'var(--accent-soft)' : 'var(--bg-card)', border: i === 0 ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', color: i === 0 ? 'var(--accent)' : 'var(--text-faint)', fontWeight: '600', marginBottom: '10px' }}>{p.label} {i === 0 ? '(bu ay)' : ''}</div>
                    <Row label="Gelir" value={`${fmt(p.income)}`} color="var(--success)" small />
                    <Row label="Sabit Gider" value={`− ${fmt(p.recurring)}`} color="var(--danger)" small />
                    <Row label={t('finance.variable')} value={`− ${fmt(p.variable)}`} color="var(--warning)" small />
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '4px' }}>
                      <Row label="Serbest" value={`${fmt(p.free)}`} color={p.free >= 0 ? 'var(--text)' : 'var(--danger)'} bold small />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Yatırım ekleme modal */}
      {showAddInv && (
        <Modal onClose={() => { setShowAddInv(false); setInvAssetType(null); setInvSelectedSymbol(null); setInvManualCode(''); setInvManualPreview(null) }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '14px' }}>{t('finance.addInvestment')}</h3>

          {!invAssetType ? (
            <>
              <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '12px' }}>{t('finance.whatToAdd')}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {ASSET_TYPES.map(at => (
                  <button key={at.key} onClick={() => setInvAssetType(at)} style={{
                    padding: '12px', background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px',
                    color: 'var(--text)', textAlign: 'left', cursor: 'pointer'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>{assetName(at.key)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px' }}>{assetCatT(at.category)}</div>
                  </button>
                ))}
              </div>
            </>
          ) : invAssetType.manualCode && (!invManualPreview || invManualPreview.error) ? (
            <>
              <div style={{ background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600' }}>{assetName(invAssetType.key)}</div>
                <button onClick={() => setInvAssetType(null)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', padding: '4px 0 0' }}>← Geri</button>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '10px' }}>{t('finance.fundCodePrompt')}</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  value={invManualCode}
                  onChange={e => setInvManualCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && checkTefasCode()}
                  placeholder="Fon kodu"
                  maxLength="6"
                  style={inputStyle}
                  autoFocus
                />
                <button onClick={checkTefasCode} style={buttonStyle}>{invManualChecking ? '...' : 'Kontrol'}</button>
              </div>
              {invManualPreview?.error && (
                <p style={{ fontSize: '12px', color: 'var(--danger)' }}>{invManualPreview.error}</p>
              )}
            </>
          ) : invAssetType.needsSymbol && !invAssetType.manualCode && !invSelectedSymbol ? (
            <>
              <div style={{ background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600' }}>{assetName(invAssetType.key)}</div>
                <button onClick={() => setInvAssetType(null)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', padding: '4px 0 0' }}>← Geri</button>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input value={invSearch} onChange={e => setInvSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchInvSymbol()}
                  placeholder={invAssetType.key === 'CRYPTO' ? 'BTC, ETH, SOL...' : invAssetType.key === 'BIST' ? 'THYAO, ASELS, GARAN...' : 'Apple, AAPL, TSLA...'}
                  style={inputStyle} autoFocus />
                <button onClick={searchInvSymbol} style={buttonStyle}>{invSearching ? '...' : 'Ara'}</button>
              </div>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {invResults.map((r, i) => (
                  <div key={i} onClick={() => setInvSelectedSymbol(r)} style={{ background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>{r.symbol}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{r.exchange || r.instrument_type}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{r.instrument_name}</div>
                  </div>
                ))}
                {invResults.length === 0 && !invSearching && <p style={{ color: 'var(--text-faint)', fontSize: '13px' }}>{t('finance.typeToSearchInvest')}</p>}
              </div>
            </>
          ) : (
            <>
              <div style={{ background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>
                  {invAssetType.manualCode ? invManualPreview.code : invAssetType.needsSymbol ? invSelectedSymbol.symbol : assetName(invAssetType.key)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                  {invAssetType.manualCode ? invManualPreview.name :
                   invAssetType.needsSymbol ? invSelectedSymbol.instrument_name :
                   `Birim: ${invAssetType.unit}`}
                </div>
                {invAssetType.manualCode && invManualPreview?.price && (
                  <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px' }}>{t('finance.current')}: ₺{invManualPreview.price.toFixed(4)}</div>
                )}
                <button onClick={() => {
                  if (invAssetType.manualCode) { setInvManualPreview(null); setInvManualCode('') }
                  else if (invAssetType.needsSymbol) setInvSelectedSymbol(null)
                  else setInvAssetType(null)
                }} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', padding: '4px 0 0' }}>{t('finance.change')}</button>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-faint)', display: 'block', marginBottom: '4px' }}>
                  {invAssetType.key === 'TRY' ? t('finance.amountTRY') :
                   invAssetType.key === 'GOLD_GRAM' || invAssetType.key === 'SILVER_GRAM' ? t('finance.gram') :
                   invAssetType.key === 'GOLD_QUARTER' ? t('finance.quarterGoldQty') :
                   invAssetType.key === 'GOLD_HALF' ? t('finance.halfGoldQty') :
                   invAssetType.key === 'GOLD_FULL' ? t('finance.fullGoldQty') :
                   invAssetType.key === 'USD' ? t('finance.usdAmount') :
                   invAssetType.key === 'EUR' ? t('finance.eurAmount') :
                   invAssetType.key === 'GBP' ? t('finance.gbpAmount') :
                   invAssetType.key === 'TEFAS_FUND' ? t('finance.shareQty') :
                   t('finance.qty')}
                </label>
                <input value={invQty} onChange={e => setInvQty(e.target.value)} type="number" step="0.000001" placeholder="0" style={{ ...inputStyle, width: '100%' }} autoFocus />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-faint)', display: 'block', marginBottom: '4px' }}>Konum</label>
                <select value={invLocation} onChange={e => setInvLocation(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
                  {LOCATIONS.map(l => <option key={l} value={l}>{l === 'Fiziksel' ? t('finance.physical') : l}</option>)}
                </select>
              </div>
              <button onClick={addInvestment} style={{ ...buttonStyle, width: '100%' }}>{t('finance.addToPortfolio')}</button>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}

function Row({ label, value, color, bold, large, small }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: small ? '6px' : '8px' }}>
      <span style={{ fontSize: small ? '11px' : '13px', color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontSize: large ? '16px' : small ? '12px' : '13px', color: color || 'var(--text)', fontWeight: bold ? '700' : '500' }}>{value}</span>
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '20px', width: '480px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '14px', right: '14px', background: 'transparent', border: 'none', color: 'var(--text-faint)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        {children}
      </div>
    </div>
  )
}

function SummaryCard({ title, value, sub, percent, color }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: percent !== undefined ? '8px' : '0' }}>{sub}</div>
      {percent !== undefined && (
        <div style={{ background: 'var(--bg-item)', borderRadius: '99px', height: '4px' }}>
          <div style={{ width: `${percent}%`, height: '4px', borderRadius: '99px', background: color, transition: 'width 0.3s' }} />
        </div>
      )}
    </div>
  )
}

function PortfolioPie({ data, total, isMobile, baseCurrency = 'TRY', t }) {
  if (data.length === 0) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
        {t('finance.assetDistribution')}
      </div>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: isMobile ? '100%' : '200px', height: '200px', flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[entry.colorKey] || '#888'} stroke="none" />
                ))}
              </Pie>
              <RTooltip
                formatter={(value) => `${formatMoney(value, baseCurrency)}`}
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: '8px', fontSize: '13px' }}
                itemStyle={{ color: 'var(--text)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, width: '100%' }}>
          {data.map(d => {
            const percent = total > 0 ? ((d.value / total) * 100).toFixed(1) : 0
            return (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: CATEGORY_COLORS[d.colorKey] || '#888', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>{d.name}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-faint)' }}>{percent}%</span>
                <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: '600', minWidth: '90px', textAlign: 'right' }}>
                  {formatMoney(d.value, baseCurrency)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  flex: 1, padding: '9px 12px', background: 'var(--bg-item)',
  border: '1px solid var(--border-strong)', borderRadius: '8px',
  color: 'var(--text)', fontSize: '14px', outline: 'none'
}
const selectStyle = {
  padding: '9px 12px', background: 'var(--bg-item)',
  border: '1px solid var(--border-strong)', borderRadius: '8px',
  color: 'var(--text)', fontSize: '14px', outline: 'none'
}
const buttonStyle = {
  padding: '9px 16px', background: 'var(--accent)',
  border: 'none', borderRadius: '8px',
  color: '#fff', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap'
}

export default Finance