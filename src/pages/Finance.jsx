import { useAuth } from '../components/AuthProvider'
import { readCachedQuotes, fetchMissingQuotes, staleAllQuotes } from '../lib/quoteCache'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BACKEND } from '../config'

const EXPENSE_CATEGORIES = ['Market', 'Yemek', 'Ulaşım', 'Kafe', 'Giyim', 'Sağlık', 'Eğlence', 'Diğer']
const RECURRING_CATEGORIES = ['Kira', 'Fatura', 'Borç', 'Abonelik', 'Diğer']
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
const GOLD_GRAMS = { GOLD_QUARTER: 1.6, GOLD_HALF: 3.2, GOLD_FULL: 6.4 }

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth <= 768)
  useEffect(() => {
    const h = () => setM(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}

function getMonthLabel(offset) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
}

// Bir due_day bugünden sonraki maaş gününe kadar olan dönemde mi?
function isDueInCurrentCycle(dueDay, currentDay, payday) {
  if (!dueDay) return true // gün belirtilmemişse her zaman dahil
  if (currentDay <= payday) {
    // Maaş gününden önceyiz (örn. bugün 2, maaş 5) → bu ay maaş gününe kadar olan günler
    return dueDay >= currentDay && dueDay <= payday
  } else {
    // Maaş gününü geçtik (örn. bugün 10, maaş 5) → ayın geri kalanı + bir sonraki maaş günü
    return dueDay >= currentDay || dueDay <= payday
  }
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
  const [newCategory, setNewCategory] = useState('Market')
  const [newDesc, setNewDesc] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [rName, setRName] = useState('')
  const [rCategory, setRCategory] = useState('Fatura')
  const [rAmount, setRAmount] = useState('')
  const [rDueDay, setRDueDay] = useState('')
  const [vName, setVName] = useState('')
  const [vAmount, setVAmount] = useState('')
  const [incomeInput, setIncomeInput] = useState('')
  const [balanceInput, setBalanceInput] = useState('')
  const [useBalance, setUseBalance] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const currentMonth = today.slice(0, 7)
  const remainingDays = getRemainingDays()
  function getRemainingDays() {
    const now = new Date()
    const currentDay = now.getDate()
    if (currentDay <= payday) return payday - currentDay + 1
    const nextPayday = new Date(now.getFullYear(), now.getMonth() + 1, payday)
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return Math.round((nextPayday - todayDate) / (1000 * 60 * 60 * 24)) + 1
  }
  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (investments.length > 0) fetchPrices() }, [investments])

  async function fetchAll() {
    const [daily, recurring, variable, inv, inc, settings] = await Promise.all([
      supabase.from('daily_expenses').select('*').order('date', { ascending: false }),
      supabase.from('recurring_expenses').select('*').order('due_day', { ascending: true }),
      supabase.from('variable_budgets').select('*').eq('month', currentMonth),
      supabase.from('investments').select('*'),
      supabase.from('income').select('*').eq('month', currentMonth).single(),
      supabase.from('user_settings').select('*').eq('key', 'payday').single()
    ])
    if (!daily.error) setDailyExpenses(daily.data)
    if (!recurring.error) setRecurringExpenses(recurring.data)
    if (!variable.error) setVariableBudgets(variable.data)
    if (!inv.error) setInvestments(inv.data)
    if (!inc.error && inc.data) {
      setIncome(inc.data)
      setIncomeInput(inc.data.amount)
      if (inc.data.balance) { setBalanceInput(inc.data.balance); setUseBalance(true) }
    }
    if (!settings.error && settings.data) setPayday(Number(settings.data.value) || 5)
  }

  async function fetchPrices(forceRefresh = false) {
    try {
      const r1 = await fetch(`${BACKEND}/api/exchange-rates`)
      const d1 = await r1.json()
      setRates(d1.rates || {})

      // Yahoo semboller
      const symbols = new Set()
      if (investments.some(i => i.type?.startsWith('GOLD_'))) symbols.add('XAU/USD')
      if (investments.some(i => i.type === 'SILVER_GRAM')) symbols.add('XAG/USD')
      investments.filter(i => i.type === 'CRYPTO' || i.type === 'STOCK' || i.type === 'BIST').forEach(i => i.symbol && symbols.add(i.symbol))
      const symbolList = [...symbols]
      if (symbolList.length > 0) {
        if (forceRefresh) staleAllQuotes()
        setQuotes(readCachedQuotes(symbolList))
        fetchMissingQuotes(symbolList, (updated) => setQuotes(updated))
      }

      // TEFAS fonları
      const tefasCodes = investments.filter(i => i.type === 'TEFAS_FUND').map(i => i.symbol).filter(Boolean)
      if (tefasCodes.length > 0) {
        const r2 = await fetch(`${BACKEND}/api/tefas-fund?codes=${encodeURIComponent(tefasCodes.join(','))}`)
        const d2 = await r2.json()
        setTefasQuotes(d2)
      }
    } catch (err) { console.error(err) }
  }

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
    if (inv.type === 'BIST') {
      const tryPrice = parseFloat(quotes[inv.symbol]?.close || 0)
      return qty * tryPrice
    }
    if (inv.type === 'TEFAS_FUND') {
      const tryPrice = parseFloat(tefasQuotes[inv.symbol]?.close || 0)
      return qty * tryPrice
    }
    if (inv.type === 'CRYPTO' || inv.type === 'STOCK') {
      const usdPrice = parseFloat(quotes[inv.symbol]?.close || 0)
      return qty * usdPrice * usdTry
    }
    return 0
  }

  function getDailyChange(inv) {
    if (inv.type === 'CRYPTO' || inv.type === 'STOCK' || inv.type === 'BIST') return parseFloat(quotes[inv.symbol]?.percent_change || 0)
    if (inv.type === 'TEFAS_FUND') return parseFloat(tefasQuotes[inv.symbol]?.percent_change || 0)
    if (inv.type === 'SILVER_GRAM') return parseFloat(quotes['XAG/USD']?.percent_change || 0)
    if (inv.type?.startsWith('GOLD_')) return parseFloat(quotes['XAU/USD']?.percent_change || 0)
    return null
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
        setInvManualPreview({ error: 'Bu kodla bir fon bulunamadı' })
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
      name = invAssetType.name
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
    await supabase.from('variable_budgets').insert({ user_id: user.id, month: currentMonth, name: vName, amount: Number(vAmount) })
    setVName(''); setVAmount(''); fetchAll()
  }

  async function deleteDaily(id) { await supabase.from('daily_expenses').delete().eq('id', id); fetchAll() }
  async function deleteRecurring(id) { await supabase.from('recurring_expenses').delete().eq('id', id); fetchAll() }
  async function deleteVariable(id) { await supabase.from('variable_budgets').delete().eq('id', id); fetchAll() }

  const totalIncome = income ? Number(income.amount) : 0
  const currentDay = new Date().getDate()
  // YENİ MANTIK: Sadece bugünden bir sonraki maaş gününe kadar olan döneme düşen giderler hesaba katılır
  const totalRecurring = recurringExpenses
    .filter(e => isDueInCurrentCycle(e.due_day, currentDay, payday))
    .reduce((s, e) => s + Number(e.amount), 0)
  const totalRecurringFull = recurringExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalVariable = variableBudgets.reduce((s, e) => s + Number(e.amount), 0)
  const baseAmount = useBalance && income?.balance ? Number(income.balance) : totalIncome
  const dailyBudget = baseAmount > 0 ? Math.round((baseAmount - totalRecurring - totalVariable) / remainingDays) : 0
  const todayTotal = dailyExpenses.filter(e => e.date === today).reduce((s, e) => s + Number(e.amount), 0)
  const monthTotal = dailyExpenses.filter(e => e.date.startsWith(currentMonth)).reduce((s, e) => s + Number(e.amount), 0)
  const limitPercent = dailyBudget > 0 ? Math.min((todayTotal / dailyBudget) * 100, 100) : 0
  const investTotal = investments.reduce((s, i) => s + getTRYValue(i), 0)

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
  const projection = [0, 1, 2].map(offset => {
    const variable = offset === 0 ? totalVariable : 0
    const free = totalIncome - totalRecurringFull - variable
    return { label: getMonthLabel(offset), income: totalIncome, recurring: totalRecurringFull, variable, free }
  })

  return (
    <div style={{ color: 'var(--text)' }}>
      <h2 style={{ marginBottom: '20px', fontSize: '22px', fontWeight: '700' }}>Finans</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <SummaryCard title="Bugünkü Harcama" value={`₺${todayTotal.toLocaleString('tr-TR')}`} sub={`Limit: ₺${dailyBudget.toLocaleString('tr-TR')} · ${remainingDays} gün`} percent={limitPercent} color={limitPercent > 80 ? 'var(--danger)' : limitPercent > 50 ? 'var(--warning)' : 'var(--success)'} />
        <SummaryCard title="Bu Ay Harcama" value={`₺${monthTotal.toLocaleString('tr-TR')}`} sub={`Gelir: ₺${totalIncome.toLocaleString('tr-TR')}`} />
        <SummaryCard title="Yatırım Portföyü" value={`₺${Math.round(investTotal).toLocaleString('tr-TR')}`} sub={`${investments.length} pozisyon${usdTry ? ` · 1$ = ${usdTry.toFixed(2)}₺` : ''}`} />
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['daily', 'recurring', 'variable', 'investments', 'income'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 14px', borderRadius: '20px', border: '1px solid',
            borderColor: tab === t ? 'var(--accent)' : 'var(--border-strong)',
            background: tab === t ? 'var(--accent)' : 'transparent',
            color: tab === t ? '#fff' : 'var(--text-dim)', fontSize: '12.5px', cursor: 'pointer'
          }}>
            {t === 'daily' ? 'Günlük' : t === 'recurring' ? 'Sabit' : t === 'variable' ? 'Değişken' : t === 'investments' ? 'Yatırım' : 'Gelir'}
          </button>
        ))}
      </div>

      {/* Günlük */}
      {tab === 'daily' && (
        <div style={{ maxWidth: '680px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Açıklama..." style={inputStyle} />
              <input value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="₺ Tutar" type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)} style={selectStyle}>
                {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ ...inputStyle, flex: isMobile ? 1 : 0, width: isMobile ? 'auto' : '160px', minWidth: '140px', fontSize: '13px' }} />
              <button onClick={addDailyExpense} style={buttonStyle}>Ekle</button>
            </div>
          </div>
          {dailyExpenses.map(e => editingId === e.id ? (
            <div key={e.id} style={{ background: 'var(--bg-soft)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <input value={editData.description} onChange={ev => setEditData(d => ({ ...d, description: ev.target.value }))} placeholder="Açıklama" style={inputStyle} />
                <input value={editData.amount} onChange={ev => setEditData(d => ({ ...d, amount: ev.target.value }))} type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select value={editData.category} onChange={ev => setEditData(d => ({ ...d, category: ev.target.value }))} style={selectStyle}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <input type="date" value={editData.date} onChange={ev => setEditData(d => ({ ...d, date: ev.target.value }))} style={{ ...inputStyle, flex: 0, width: '160px' }} />
                <button onClick={() => saveEdit('daily')} style={buttonStyle}>Kaydet</button>
                <button onClick={() => setEditingId(null)} style={{ ...buttonStyle, background: 'var(--bg-item)', color: 'var(--text-secondary)' }}>İptal</button>
              </div>
            </div>
          ) : (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', background: 'var(--bg-card)', borderRadius: '6px', padding: '3px 8px', color: 'var(--text-muted)', flexShrink: 0 }}>{e.category}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description || '—'}</span>
              {!isMobile && <span style={{ fontSize: '12px', color: 'var(--text-faint)', flexShrink: 0 }}>{new Date(e.date + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>}
              <span style={{ fontSize: '14px', color: 'var(--text)', fontWeight: '600', flexShrink: 0 }}>₺{Number(e.amount).toLocaleString('tr-TR')}</span>
              <span onClick={() => startEdit(e, 'daily')} style={{ color: 'var(--text-dim)', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>✏️</span>
              <span onClick={() => deleteDaily(e.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>✕</span>
            </div>
          ))}
          {dailyExpenses.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>Harcama yok.</p>}
        </div>
      )}

      {/* Sabit Giderler */}
      {tab === 'recurring' && (
        <div style={{ maxWidth: '680px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <input value={rName} onChange={e => setRName(e.target.value)} placeholder="İsim (örn. Elektrik)" style={inputStyle} />
              <input value={rAmount} onChange={e => setRAmount(e.target.value)} placeholder="₺ Tutar" type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select value={rCategory} onChange={e => setRCategory(e.target.value)} style={selectStyle}>
                {RECURRING_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <input value={rDueDay} onChange={e => setRDueDay(e.target.value)} placeholder="Ödeme günü" type="number" min="1" max="31" style={{ ...inputStyle, flex: isMobile ? 1 : 0, width: isMobile ? 'auto' : '160px', minWidth: '120px', fontSize: '13px' }} />
              <button onClick={addRecurring} style={buttonStyle}>Ekle</button>
            </div>
          </div>
          {[...unpaidRecurring, ...paidRecurring].map(e => editingId === e.id ? (
            <div key={e.id} style={{ background: 'var(--bg-soft)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <input value={editData.name} onChange={ev => setEditData(d => ({ ...d, name: ev.target.value }))} placeholder="İsim" style={inputStyle} />
                <input value={editData.amount} onChange={ev => setEditData(d => ({ ...d, amount: ev.target.value }))} type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select value={editData.category} onChange={ev => setEditData(d => ({ ...d, category: ev.target.value }))} style={selectStyle}>
                  {RECURRING_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <input value={editData.due_day} onChange={ev => setEditData(d => ({ ...d, due_day: ev.target.value }))} placeholder="Ödeme günü" type="number" min="1" max="31" style={{ ...inputStyle, flex: 0, width: '150px' }} />
                <button onClick={() => saveEdit('recurring')} style={buttonStyle}>Kaydet</button>
                <button onClick={() => setEditingId(null)} style={{ ...buttonStyle, background: 'var(--bg-item)', color: 'var(--text-secondary)' }}>İptal</button>
              </div>
            </div>
          ) : (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', opacity: paidStatus[e.id] ? 0.5 : 1, flexWrap: 'wrap' }}>
              <div onClick={() => setPaidStatus(p => ({ ...p, [e.id]: !p[e.id] }))} style={{ width: '18px', height: '18px', borderRadius: '5px', border: '2px solid', borderColor: paidStatus[e.id] ? 'var(--success)' : 'var(--text-faint)', background: paidStatus[e.id] ? 'var(--success)' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {paidStatus[e.id] && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <span style={{ fontSize: '11px', background: 'var(--bg-card)', borderRadius: '6px', padding: '3px 8px', color: 'var(--text-muted)', flexShrink: 0 }}>{e.category}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: '80px' }}>{e.name}</span>
              {e.due_day && !isMobile && <span style={{ fontSize: '12px', color: !paidStatus[e.id] && new Date().getDate() >= e.due_day - 2 ? 'var(--warning)' : 'var(--text-faint)', flexShrink: 0 }}>{!paidStatus[e.id] && new Date().getDate() >= e.due_day - 2 ? '⚠️ ' : '📅 '}{e.due_day}'i</span>}
              <span style={{ fontSize: '14px', color: 'var(--text)', fontWeight: '600', flexShrink: 0 }}>₺{Number(e.amount).toLocaleString('tr-TR')}</span>
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
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input value={vName} onChange={e => setVName(e.target.value)} placeholder="İsim (örn. Yatırım)" style={inputStyle} />
              <input value={vAmount} onChange={e => setVAmount(e.target.value)} placeholder="₺ Tutar" type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
              <button onClick={addVariableBudget} style={buttonStyle}>Ekle</button>
            </div>
          </div>
          {variableBudgets.map(e => editingId === e.id ? (
            <div key={e.id} style={{ background: 'var(--bg-soft)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input value={editData.name} onChange={ev => setEditData(d => ({ ...d, name: ev.target.value }))} placeholder="İsim" style={inputStyle} />
                <input value={editData.amount} onChange={ev => setEditData(d => ({ ...d, amount: ev.target.value }))} type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
                <button onClick={() => saveEdit('variable')} style={buttonStyle}>Kaydet</button>
                <button onClick={() => setEditingId(null)} style={{ ...buttonStyle, background: 'var(--bg-item)', color: 'var(--text-secondary)' }}>İptal</button>
              </div>
            </div>
          ) : (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</span>
              <span style={{ fontSize: '14px', color: 'var(--text)', fontWeight: '600' }}>₺{Number(e.amount).toLocaleString('tr-TR')}</span>
              <span onClick={() => startEdit(e, 'variable')} style={{ color: 'var(--text-dim)', cursor: 'pointer', fontSize: '13px' }}>✏️</span>
              <span onClick={() => deleteVariable(e.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '14px' }}>✕</span>
            </div>
          ))}
          {variableBudgets.length > 0 && (
            <div style={{ marginTop: '14px', padding: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Toplam Değişken Bütçe</span>
                <span style={{ color: 'var(--text)', fontWeight: '700' }}>₺{totalVariable.toLocaleString('tr-TR')}</span>
              </div>
            </div>
          )}
          {variableBudgets.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>Değişken bütçe yok.</p>}
        </div>
      )}

      {/* Yatırımlar */}
      {tab === 'investments' && (
        <div style={{ maxWidth: '780px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-faint)', flex: 1, minWidth: '160px' }}>
              {usdTry ? `1$ = ${usdTry.toFixed(2)}₺ · 1€ = ${rates.EUR ? (usdTry / rates.EUR).toFixed(2) : '...'}₺` : 'Kurlar yükleniyor...'}
            </div>
            <button onClick={() => fetchPrices(true)} style={{ ...buttonStyle, background: 'var(--bg-item)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '12px', padding: '5px 12px' }}>↻ Yenile</button>
            <button onClick={() => setShowAddInv(true)} style={{ ...buttonStyle, fontSize: '13px' }}>+ Ekle</button>
          </div>

          {Object.values(grouped).map(g => (
            <div key={g.key} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', gap: '8px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.displayName}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px' }}>
                    Toplam {g.totalQty.toLocaleString('tr-TR', { maximumFractionDigits: 6 })} {g.unit}
                    {g.dailyChange !== null && !isNaN(g.dailyChange) && (
                      <span style={{ marginLeft: '8px', color: g.dailyChange >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {g.dailyChange >= 0 ? '+' : ''}{g.dailyChange.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '17px', fontWeight: '700', flexShrink: 0 }}>₺{Math.round(g.totalTRY).toLocaleString('tr-TR')}</div>
              </div>

              {g.items.map(i => editingId === i.id ? (
                <div key={i.id} style={{ background: 'var(--bg-soft)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '10px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input value={editData.quantity} onChange={ev => setEditData(d => ({ ...d, quantity: ev.target.value }))} type="number" step="0.000001" style={{ ...inputStyle, flex: 1, minWidth: '120px' }} />
                    <select value={editData.location} onChange={ev => setEditData(d => ({ ...d, location: ev.target.value }))} style={selectStyle}>
                      {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                    </select>
                    <button onClick={() => saveEdit('investment')} style={buttonStyle}>Kaydet</button>
                    <button onClick={() => setEditingId(null)} style={{ ...buttonStyle, background: 'var(--bg-item)', color: 'var(--text-secondary)' }}>İptal</button>
                  </div>
                </div>
              ) : (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', background: 'var(--bg-card)', borderRadius: '6px', padding: '3px 8px', color: 'var(--text-muted)', flexShrink: 0 }}>{i.location}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {Number(i.quantity).toLocaleString('tr-TR', { maximumFractionDigits: 6 })} {g.unit}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>₺{Math.round(getTRYValue(i)).toLocaleString('tr-TR')}</span>
                  <span onClick={() => startEdit(i, 'investment')} style={{ color: 'var(--text-dim)', cursor: 'pointer', fontSize: '13px' }}>✏️</span>
                  <span onClick={() => deleteInvestment(i.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '13px' }}>✕</span>
                </div>
              ))}
            </div>
          ))}

          {investments.length === 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>Henüz yatırım eklenmedi.</p>
            </div>
          )}

          {investments.length > 0 && (
            <div style={{ marginTop: '14px', padding: '14px', background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600' }}>Toplam Portföy</span>
              <span style={{ color: 'var(--text)', fontWeight: '700', fontSize: '18px' }}>₺{Math.round(investTotal).toLocaleString('tr-TR')}</span>
            </div>
          )}
        </div>
      )}

      {/* Gelir & Projeksiyon */}
      {tab === 'income' && (
        <div style={{ maxWidth: '780px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>{currentMonth} — maaş günü:</span>
              <input
                type="number" min="1" max="31"
                value={payday}
                onChange={e => savePayday(e.target.value)}
                style={{ ...inputStyle, flex: 0, width: '60px', padding: '5px 8px', fontSize: '13px', textAlign: 'center' }}
              />
              <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>her ayın</span>
            </div>
            <input value={incomeInput} onChange={e => setIncomeInput(e.target.value)} placeholder="₺ Aylık maaş" type="number" style={{ ...inputStyle, width: '100%', marginBottom: '8px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div onClick={() => setUseBalance(!useBalance)} style={{ width: '18px', height: '18px', borderRadius: '5px', border: '2px solid', borderColor: useBalance ? 'var(--accent)' : 'var(--text-faint)', background: useBalance ? 'var(--accent)' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {useBalance && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Maaş yerine mevcut bakiyemi kullan</span>
            </div>
            {useBalance && (
              <input value={balanceInput} onChange={e => setBalanceInput(e.target.value)} placeholder="₺ Mevcut bakiye" type="number" style={{ ...inputStyle, width: '100%', marginBottom: '8px' }} />
            )}
            <button onClick={saveIncome} style={buttonStyle}>Kaydet</button>
          </div>

          {totalIncome > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Bu Ay</div>
              <Row label="Aylık Maaş" value={`₺${totalIncome.toLocaleString('tr-TR')}`} color="var(--success)" />
              {useBalance && income?.balance && (
                <Row label="Mevcut Bakiye (baz alınan)" value={`₺${Number(income.balance).toLocaleString('tr-TR')}`} color="var(--purple)" />
              )}
              <Row label="Sabit Giderler (kalan dönem)" value={`− ₺${totalRecurring.toLocaleString('tr-TR')}`} color="var(--danger)" />
              <Row label="Değişken Bütçe" value={`− ₺${totalVariable.toLocaleString('tr-TR')}`} color="var(--warning)" />
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '4px' }}>
                <Row label="Kullanılabilir Bütçe" value={`₺${(baseAmount - totalRecurring - totalVariable).toLocaleString('tr-TR')}`} bold />
                <Row label={`Günlük Limit (${remainingDays} gün kaldı)`} value={`₺${dailyBudget.toLocaleString('tr-TR')}`} color="var(--accent)" bold large />
              </div>
            </div>
          )}

          {totalIncome > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>3 Aylık Projeksiyon</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                {projection.map((p, i) => (
                  <div key={i} style={{ background: i === 0 ? 'var(--accent-soft)' : 'var(--bg-card)', border: i === 0 ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', color: i === 0 ? 'var(--accent)' : 'var(--text-faint)', fontWeight: '600', marginBottom: '10px' }}>{p.label} {i === 0 ? '(bu ay)' : ''}</div>
                    <Row label="Gelir" value={`₺${p.income.toLocaleString('tr-TR')}`} color="var(--success)" small />
                    <Row label="Sabit Gider" value={`− ₺${p.recurring.toLocaleString('tr-TR')}`} color="var(--danger)" small />
                    <Row label="Değişken" value={`− ₺${p.variable.toLocaleString('tr-TR')}`} color="var(--warning)" small />
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '4px' }}>
                      <Row label="Serbest" value={`₺${p.free.toLocaleString('tr-TR')}`} color={p.free >= 0 ? 'var(--text)' : 'var(--danger)'} bold small />
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '14px' }}>Yatırım Ekle</h3>

          {!invAssetType ? (
            <>
              <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '12px' }}>Ne eklemek istiyorsun?</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {ASSET_TYPES.map(at => (
                  <button key={at.key} onClick={() => setInvAssetType(at)} style={{
                    padding: '12px', background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px',
                    color: 'var(--text)', textAlign: 'left', cursor: 'pointer'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>{at.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px' }}>{at.category}</div>
                  </button>
                ))}
              </div>
            </>
          ) : invAssetType.manualCode && (!invManualPreview || invManualPreview.error) ? (
            <>
              <div style={{ background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600' }}>{invAssetType.name}</div>
                <button onClick={() => setInvAssetType(null)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', padding: '4px 0 0' }}>← Geri</button>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '10px' }}>Fon kodunu yaz (örn. BID, AAK, GO9):</p>
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
                <div style={{ fontSize: '13px', fontWeight: '600' }}>{invAssetType.name}</div>
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
                {invResults.length === 0 && !invSearching && <p style={{ color: 'var(--text-faint)', fontSize: '13px' }}>Aramak için yukarıya yazın.</p>}
              </div>
            </>
          ) : (
            <>
              <div style={{ background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>
                  {invAssetType.manualCode ? invManualPreview.code : invAssetType.needsSymbol ? invSelectedSymbol.symbol : invAssetType.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                  {invAssetType.manualCode ? invManualPreview.name :
                   invAssetType.needsSymbol ? invSelectedSymbol.instrument_name :
                   `Birim: ${invAssetType.unit}`}
                </div>
                {invAssetType.manualCode && invManualPreview?.price && (
                  <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px' }}>Güncel: ₺{invManualPreview.price.toFixed(4)}</div>
                )}
                <button onClick={() => {
                  if (invAssetType.manualCode) { setInvManualPreview(null); setInvManualCode('') }
                  else if (invAssetType.needsSymbol) setInvSelectedSymbol(null)
                  else setInvAssetType(null)
                }} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', padding: '4px 0 0' }}>← Değiştir</button>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-faint)', display: 'block', marginBottom: '4px' }}>
                  {invAssetType.key === 'TRY' ? 'Tutar (₺)' :
                   invAssetType.key === 'GOLD_GRAM' || invAssetType.key === 'SILVER_GRAM' ? 'Gram' :
                   invAssetType.key === 'GOLD_QUARTER' ? 'Çeyrek altın adedi' :
                   invAssetType.key === 'GOLD_HALF' ? 'Yarım altın adedi' :
                   invAssetType.key === 'GOLD_FULL' ? 'Tam altın adedi' :
                   invAssetType.key === 'USD' ? 'Dolar miktarı ($)' :
                   invAssetType.key === 'EUR' ? 'Euro miktarı (€)' :
                   invAssetType.key === 'GBP' ? 'Sterlin miktarı (£)' :
                   invAssetType.key === 'TEFAS_FUND' ? 'Pay adedi' :
                   'Adet'}
                </label>
                <input value={invQty} onChange={e => setInvQty(e.target.value)} type="number" step="0.000001" placeholder="0" style={{ ...inputStyle, width: '100%' }} autoFocus />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-faint)', display: 'block', marginBottom: '4px' }}>Konum</label>
                <select value={invLocation} onChange={e => setInvLocation(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
                  {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <button onClick={addInvestment} style={{ ...buttonStyle, width: '100%' }}>Portföye Ekle</button>
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