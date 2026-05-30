import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BACKEND } from '../config'

const EXPENSE_CATEGORIES = ['Market', 'Yemek', 'Ulaşım', 'Kafe', 'Giyim', 'Sağlık', 'Eğlence', 'Diğer']
const RECURRING_CATEGORIES = ['Kira', 'Fatura', 'Borç', 'Abonelik', 'Diğer']
const LOCATIONS = ['Fiziksel', 'Vakıfbank', 'Yapı Kredi', 'Midas']

// Sabit varlık türleri — her biri için: assetKey, name, unit, ve hesaplama mantığı
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
]

// Çeyrek/Yarım/Tam altın → kaç gram (saf altın değil, piyasa karşılığı)
const GOLD_GRAMS = { GOLD_QUARTER: 1.6, GOLD_HALF: 3.2, GOLD_FULL: 6.4 }

function getRemainingDays() {
  const now = new Date()
  const currentDay = now.getDate()
  if (currentDay <= 5) return 5 - currentDay + 1
  const next5 = new Date(now.getFullYear(), now.getMonth() + 1, 5)
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((next5 - todayDate) / (1000 * 60 * 60 * 24)) + 1
}

function getMonthLabel(offset) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
}

function Finance() {
  const [tab, setTab] = useState('daily')
  const [dailyExpenses, setDailyExpenses] = useState([])
  const [recurringExpenses, setRecurringExpenses] = useState([])
  const [variableBudgets, setVariableBudgets] = useState([])
  const [investments, setInvestments] = useState([])
  const [income, setIncome] = useState(null)
  const [paidStatus, setPaidStatus] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})

  // Canlı fiyatlar
  const [rates, setRates] = useState({}) // ExchangeRate-API
  const [quotes, setQuotes] = useState({}) // Twelve Data

  // Yatırım ekleme
  const [showAddInv, setShowAddInv] = useState(false)
  const [invAssetType, setInvAssetType] = useState(null) // ASSET_TYPES'tan biri
  const [invSearch, setInvSearch] = useState('')
  const [invResults, setInvResults] = useState([])
  const [invSearching, setInvSearching] = useState(false)
  const [invSelectedSymbol, setInvSelectedSymbol] = useState(null) // {symbol, name} (kripto/hisse için)
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

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (investments.length > 0) fetchPrices() }, [investments])

  async function fetchAll() {
    const [daily, recurring, variable, inv, inc] = await Promise.all([
      supabase.from('daily_expenses').select('*').order('date', { ascending: false }),
      supabase.from('recurring_expenses').select('*').order('due_day', { ascending: true }),
      supabase.from('variable_budgets').select('*').eq('month', currentMonth),
      supabase.from('investments').select('*'),
      supabase.from('income').select('*').eq('month', currentMonth).single()
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
  }

  async function fetchPrices() {
    try {
      // 1) ExchangeRate-API (TRY ve diğer dövizler)
      const r1 = await fetch(`${BACKEND}/api/exchange-rates`)
      const d1 = await r1.json()
      setRates(d1.rates || {})

      // 2) Twelve Data — altın, gümüş + kripto/hisse sembolleri
      const symbols = new Set()
      // Altın ve gümüş her zaman gerekli (ekli ise)
      const hasGold = investments.some(i => i.type?.startsWith('GOLD_'))
      const hasSilver = investments.some(i => i.type === 'SILVER_GRAM')
      if (hasGold) symbols.add('XAU/USD')
      if (hasSilver) symbols.add('XAG/USD')
      // Kripto ve hisse — her birinin sembolü
      investments.filter(i => i.type === 'CRYPTO' || i.type === 'STOCK').forEach(i => {
        if (i.symbol) symbols.add(i.symbol)
      })

      if (symbols.size > 0) {
        const r2 = await fetch(`${BACKEND}/api/quote?symbols=${encodeURIComponent([...symbols].join(','))}`)
        const d2 = await r2.json()
        setQuotes(d2)
      }
    } catch (err) {
      console.error(err)
    }
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

    if (inv.type === 'CRYPTO' || inv.type === 'STOCK') {
      const usdPrice = parseFloat(quotes[inv.symbol]?.close || 0)
      return qty * usdPrice * usdTry
    }

    return 0
  }

  function getDailyChange(inv) {
    if (inv.type === 'CRYPTO' || inv.type === 'STOCK') {
      return parseFloat(quotes[inv.symbol]?.percent_change || 0)
    }
    if (inv.type === 'SILVER_GRAM') return parseFloat(quotes['XAG/USD']?.percent_change || 0)
    if (inv.type?.startsWith('GOLD_')) return parseFloat(quotes['XAU/USD']?.percent_change || 0)
    return null
  }

  async function searchInvSymbol() {
    if (!invSearch.trim() || !invAssetType?.needsSymbol) return
    setInvSearching(true)
    try {
      const apiType = invAssetType.key === 'CRYPTO' ? 'crypto' : 'stock'
      const res = await fetch(`${BACKEND}/api/symbol-search?q=${encodeURIComponent(invSearch)}&type=${apiType}`)
      const data = await res.json()
      setInvResults(data.results || [])
    } catch (err) {
      console.error(err)
    } finally {
      setInvSearching(false)
    }
  }

  async function addInvestment() {
    if (!invAssetType || !invQty) return

    let symbol, name
    if (invAssetType.needsSymbol) {
      if (!invSelectedSymbol) return
      symbol = invSelectedSymbol.symbol
      name = invSelectedSymbol.instrument_name || invSelectedSymbol.symbol
    } else {
      symbol = invAssetType.key
      name = invAssetType.name
    }

    await supabase.from('investments').insert({
      symbol, name, type: invAssetType.key,
      quantity: Number(invQty), location: invLocation
    })

    setShowAddInv(false)
    setInvAssetType(null); setInvSelectedSymbol(null); setInvSearch(''); setInvResults([])
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
      await supabase.from('variable_budgets').update({
        name: editData.name, amount: Number(editData.amount)
      }).eq('id', editingId)
    }
    if (type === 'investment') {
      await supabase.from('investments').update({
        quantity: Number(editData.quantity), location: editData.location, updated_at: new Date()
      }).eq('id', editingId)
    }
    if (type === 'daily') {
      await supabase.from('daily_expenses').update({
        description: editData.description || null,
        category: editData.category,
        amount: Number(editData.amount),
        date: editData.date
      }).eq('id', editingId)
    }
    setEditingId(null)
    setEditData({})
    fetchAll()
  }

  async function saveIncome() {
    if (!incomeInput) return
    const payload = { amount: Number(incomeInput), balance: useBalance && balanceInput ? Number(balanceInput) : null }
    if (income) { await supabase.from('income').update(payload).eq('id', income.id) }
    else { await supabase.from('income').insert({ ...payload, month: currentMonth }) }
    fetchAll()
  }

  async function addDailyExpense() {
    if (!newAmount) return
    await supabase.from('daily_expenses').insert({ date: newDate, category: newCategory, description: newDesc || null, amount: Number(newAmount) })
    setNewAmount(''); setNewDesc(''); fetchAll()
  }

  async function addRecurring() {
    if (!rAmount || !rName) return
    await supabase.from('recurring_expenses').insert({ name: rName, category: rCategory, amount: Number(rAmount), due_day: rDueDay ? Number(rDueDay) : null })
    setRName(''); setRAmount(''); setRDueDay(''); fetchAll()
  }

  async function addVariableBudget() {
    if (!vAmount || !vName) return
    await supabase.from('variable_budgets').insert({ month: currentMonth, name: vName, amount: Number(vAmount) })
    setVName(''); setVAmount(''); fetchAll()
  }

  async function deleteDaily(id) { await supabase.from('daily_expenses').delete().eq('id', id); fetchAll() }
  async function deleteRecurring(id) { await supabase.from('recurring_expenses').delete().eq('id', id); fetchAll() }
  async function deleteVariable(id) { await supabase.from('variable_budgets').delete().eq('id', id); fetchAll() }

  const totalIncome = income ? Number(income.amount) : 0
  const currentDay = new Date().getDate()
  const totalRecurring = recurringExpenses.filter(e => !e.due_day || e.due_day >= currentDay || e.due_day < 5).reduce((s, e) => s + Number(e.amount), 0)
  const totalRecurringFull = recurringExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalVariable = variableBudgets.reduce((s, e) => s + Number(e.amount), 0)
  const baseAmount = useBalance && income?.balance ? Number(income.balance) : totalIncome
  const dailyBudget = baseAmount > 0 ? Math.round((baseAmount - totalRecurring - totalVariable) / remainingDays) : 0
  const todayTotal = dailyExpenses.filter(e => e.date === today).reduce((s, e) => s + Number(e.amount), 0)
  const monthTotal = dailyExpenses.filter(e => e.date.startsWith(currentMonth)).reduce((s, e) => s + Number(e.amount), 0)
  const limitPercent = dailyBudget > 0 ? Math.min((todayTotal / dailyBudget) * 100, 100) : 0

  const investTotal = investments.reduce((s, i) => s + getTRYValue(i), 0)

  // Varlığa göre grupla — TRY hariç (TRY tek grup), altın altları da kendi türlerinde grup
  const grouped = {}
  investments.forEach(i => {
    const key = i.type === 'CRYPTO' || i.type === 'STOCK' ? i.symbol : i.type
    if (!grouped[key]) {
      const at = ASSET_TYPES.find(a => a.key === i.type)
      grouped[key] = {
        key, type: i.type, symbol: i.symbol, name: i.name,
        displayName: at ? at.name : i.name,
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
  const projection = [0, 1, 2].map(offset => ({ label: getMonthLabel(offset), income: totalIncome, recurring: totalRecurringFull, variable: totalVariable, free: monthlyFree }))

  return (
    <div style={{ color: '#fff' }}>
      <h2 style={{ marginBottom: '24px', fontSize: '22px', fontWeight: '700' }}>Finans</h2>

      <div style={{ display: 'flex', gap: '14px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <SummaryCard title="Bugünkü Harcama" value={`₺${todayTotal.toLocaleString('tr-TR')}`} sub={`Günlük limit: ₺${dailyBudget.toLocaleString('tr-TR')} · ${remainingDays} gün kaldı`} percent={limitPercent} color={limitPercent > 80 ? '#f87171' : limitPercent > 50 ? '#fbbf24' : '#6ee7b7'} />
        <SummaryCard title="Bu Ay Harcama" value={`₺${monthTotal.toLocaleString('tr-TR')}`} sub={`Gelir: ₺${totalIncome.toLocaleString('tr-TR')}`} />
        <SummaryCard title="Yatırım Portföyü" value={`₺${Math.round(investTotal).toLocaleString('tr-TR')}`} sub={`${investments.length} pozisyon${usdTry ? ` · 1$ = ${usdTry.toFixed(2)}₺` : ''}`} />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {['daily', 'recurring', 'variable', 'investments', 'income'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 16px', borderRadius: '20px', border: '1px solid',
            borderColor: tab === t ? '#6366f1' : '#2a2a2a',
            background: tab === t ? '#6366f1' : 'transparent',
            color: tab === t ? '#fff' : '#666', fontSize: '13px', cursor: 'pointer'
          }}>
            {t === 'daily' ? 'Günlük' : t === 'recurring' ? 'Sabit Giderler' : t === 'variable' ? 'Değişken Bütçe' : t === 'investments' ? 'Yatırımlar' : 'Gelir & Projeksiyon'}
          </button>
        ))}
      </div>

      {/* Günlük */}
      {tab === 'daily' && (
        <div style={{ maxWidth: '680px' }}>
          <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Açıklama..." style={inputStyle} />
              <input value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="₺ Tutar" type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)} style={selectStyle}>
                {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ ...inputStyle, flex: 0, width: '160px', fontSize: '13px' }} />
              <button onClick={addDailyExpense} style={buttonStyle}>Ekle</button>
            </div>
          </div>
          {dailyExpenses.map(e => editingId === e.id ? (
            <div key={e.id} style={{ background: '#1e1e2e', border: '1px solid #6366f1', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input value={editData.description} onChange={ev => setEditData(d => ({ ...d, description: ev.target.value }))} placeholder="Açıklama" style={inputStyle} />
                <input value={editData.amount} onChange={ev => setEditData(d => ({ ...d, amount: ev.target.value }))} type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={editData.category} onChange={ev => setEditData(d => ({ ...d, category: ev.target.value }))} style={selectStyle}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <input type="date" value={editData.date} onChange={ev => setEditData(d => ({ ...d, date: ev.target.value }))} style={{ ...inputStyle, flex: 0, width: '160px' }} />
                <button onClick={() => saveEdit('daily')} style={buttonStyle}>Kaydet</button>
                <button onClick={() => setEditingId(null)} style={{ ...buttonStyle, background: '#333' }}>İptal</button>
              </div>
            </div>
          ) : (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', background: '#222', borderRadius: '6px', padding: '3px 8px', color: '#888', flexShrink: 0 }}>{e.category}</span>
              <span style={{ fontSize: '13px', color: '#ccc', flex: 1 }}>{e.description || '—'}</span>
              <span style={{ fontSize: '12px', color: '#555', flexShrink: 0 }}>{new Date(e.date + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
              <span style={{ fontSize: '14px', color: '#fff', fontWeight: '600', flexShrink: 0 }}>₺{Number(e.amount).toLocaleString('tr-TR')}</span>
              <span onClick={() => startEdit(e, 'daily')} style={{ color: '#666', cursor: 'pointer', fontSize: '13px' }}>✏️</span>
              <span onClick={() => deleteDaily(e.id)} style={{ color: '#444', cursor: 'pointer', fontSize: '14px' }}>✕</span>
            </div>
          ))}
          {dailyExpenses.length === 0 && <p style={{ color: '#555', fontSize: '14px' }}>Harcama yok.</p>}
        </div>
      )}

      {/* Sabit Giderler */}
      {tab === 'recurring' && (
        <div style={{ maxWidth: '680px' }}>
          <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input value={rName} onChange={e => setRName(e.target.value)} placeholder="İsim (örn. Elektrik)" style={inputStyle} />
              <input value={rAmount} onChange={e => setRAmount(e.target.value)} placeholder="₺ Tutar" type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={rCategory} onChange={e => setRCategory(e.target.value)} style={selectStyle}>
                {RECURRING_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <input value={rDueDay} onChange={e => setRDueDay(e.target.value)} placeholder="Ödeme günü (1-31)" type="number" min="1" max="31" style={{ ...inputStyle, flex: 0, width: '180px', fontSize: '13px' }} />
              <button onClick={addRecurring} style={buttonStyle}>Ekle</button>
            </div>
          </div>
          {[...unpaidRecurring, ...paidRecurring].map(e => editingId === e.id ? (
            <div key={e.id} style={{ background: '#1e1e2e', border: '1px solid #6366f1', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input value={editData.name} onChange={ev => setEditData(d => ({ ...d, name: ev.target.value }))} placeholder="İsim" style={inputStyle} />
                <input value={editData.amount} onChange={ev => setEditData(d => ({ ...d, amount: ev.target.value }))} type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={editData.category} onChange={ev => setEditData(d => ({ ...d, category: ev.target.value }))} style={selectStyle}>
                  {RECURRING_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <input value={editData.due_day} onChange={ev => setEditData(d => ({ ...d, due_day: ev.target.value }))} placeholder="Ödeme günü" type="number" min="1" max="31" style={{ ...inputStyle, flex: 0, width: '150px' }} />
                <button onClick={() => saveEdit('recurring')} style={buttonStyle}>Kaydet</button>
                <button onClick={() => setEditingId(null)} style={{ ...buttonStyle, background: '#333' }}>İptal</button>
              </div>
            </div>
          ) : (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', opacity: paidStatus[e.id] ? 0.5 : 1 }}>
              <div onClick={() => setPaidStatus(p => ({ ...p, [e.id]: !p[e.id] }))} style={{ width: '18px', height: '18px', borderRadius: '5px', border: '2px solid', borderColor: paidStatus[e.id] ? '#6ee7b7' : '#555', background: paidStatus[e.id] ? '#6ee7b7' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {paidStatus[e.id] && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <span style={{ fontSize: '12px', background: '#222', borderRadius: '6px', padding: '3px 8px', color: '#888', flexShrink: 0 }}>{e.category}</span>
              <span style={{ fontSize: '13px', color: '#ccc', flex: 1 }}>{e.name}</span>
              {e.due_day && <span style={{ fontSize: '12px', color: !paidStatus[e.id] && new Date().getDate() >= e.due_day - 2 ? '#fbbf24' : '#555', flexShrink: 0 }}>{!paidStatus[e.id] && new Date().getDate() >= e.due_day - 2 ? '⚠️ ' : '📅 '}Her ayın {e.due_day}'i</span>}
              <span style={{ fontSize: '14px', color: '#fff', fontWeight: '600', flexShrink: 0 }}>₺{Number(e.amount).toLocaleString('tr-TR')}</span>
              <span onClick={() => startEdit(e, 'recurring')} style={{ color: '#666', cursor: 'pointer', fontSize: '13px' }}>✏️</span>
              <span onClick={() => deleteRecurring(e.id)} style={{ color: '#444', cursor: 'pointer', fontSize: '14px' }}>✕</span>
            </div>
          ))}
          {recurringExpenses.length === 0 && <p style={{ color: '#555', fontSize: '14px' }}>Sabit gider yok.</p>}
        </div>
      )}

      {/* Değişken Bütçe */}
      {tab === 'variable' && (
        <div style={{ maxWidth: '680px' }}>
          <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={vName} onChange={e => setVName(e.target.value)} placeholder="İsim (örn. Yatırım)" style={inputStyle} />
              <input value={vAmount} onChange={e => setVAmount(e.target.value)} placeholder="₺ Tutar" type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
              <button onClick={addVariableBudget} style={buttonStyle}>Ekle</button>
            </div>
          </div>
          {variableBudgets.map(e => editingId === e.id ? (
            <div key={e.id} style={{ background: '#1e1e2e', border: '1px solid #6366f1', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={editData.name} onChange={ev => setEditData(d => ({ ...d, name: ev.target.value }))} placeholder="İsim" style={inputStyle} />
                <input value={editData.amount} onChange={ev => setEditData(d => ({ ...d, amount: ev.target.value }))} type="number" style={{ ...inputStyle, flex: 0, width: '120px' }} />
                <button onClick={() => saveEdit('variable')} style={buttonStyle}>Kaydet</button>
                <button onClick={() => setEditingId(null)} style={{ ...buttonStyle, background: '#333' }}>İptal</button>
              </div>
            </div>
          ) : (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#ccc', flex: 1 }}>{e.name}</span>
              <span style={{ fontSize: '14px', color: '#fff', fontWeight: '600' }}>₺{Number(e.amount).toLocaleString('tr-TR')}</span>
              <span onClick={() => startEdit(e, 'variable')} style={{ color: '#666', cursor: 'pointer', fontSize: '13px' }}>✏️</span>
              <span onClick={() => deleteVariable(e.id)} style={{ color: '#444', cursor: 'pointer', fontSize: '14px' }}>✕</span>
            </div>
          ))}
          {variableBudgets.length > 0 && (
            <div style={{ marginTop: '16px', padding: '14px', background: '#161616', border: '1px solid #222', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666', fontSize: '13px' }}>Toplam Değişken Bütçe</span>
                <span style={{ color: '#fff', fontWeight: '700' }}>₺{totalVariable.toLocaleString('tr-TR')}</span>
              </div>
            </div>
          )}
          {variableBudgets.length === 0 && <p style={{ color: '#555', fontSize: '14px' }}>Değişken bütçe yok.</p>}
        </div>
      )}

      {/* Yatırımlar */}
      {tab === 'investments' && (
        <div style={{ maxWidth: '780px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: '#555' }}>
              {usdTry ? `1$ = ${usdTry.toFixed(2)}₺ · 1€ = ${rates.EUR ? (usdTry / rates.EUR).toFixed(2) : '...'}₺` : 'Kurlar yükleniyor...'}
            </div>
            <button onClick={fetchPrices} style={{ ...buttonStyle, background: '#222', fontSize: '12px', padding: '5px 12px' }}>↻ Yenile</button>
            <button onClick={() => setShowAddInv(true)} style={{ ...buttonStyle, fontSize: '13px', marginLeft: 'auto' }}>+ Ekle</button>
          </div>

          {Object.values(grouped).map(g => (
            <div key={g.key} style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600' }}>{g.displayName}</div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                    Toplam {g.totalQty.toLocaleString('tr-TR', { maximumFractionDigits: 6 })} {g.unit}
                    {g.dailyChange !== null && !isNaN(g.dailyChange) && (
                      <span style={{ marginLeft: '10px', color: g.dailyChange >= 0 ? '#6ee7b7' : '#f87171' }}>
                        {g.dailyChange >= 0 ? '+' : ''}{g.dailyChange.toFixed(2)}% (gün)
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700' }}>₺{Math.round(g.totalTRY).toLocaleString('tr-TR')}</div>
              </div>

              {g.items.map(i => editingId === i.id ? (
                <div key={i.id} style={{ background: '#1e1e2e', border: '1px solid #6366f1', borderRadius: '8px', padding: '10px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input value={editData.quantity} onChange={ev => setEditData(d => ({ ...d, quantity: ev.target.value }))} type="number" step="0.000001" style={{ ...inputStyle, flex: 1 }} />
                    <select value={editData.location} onChange={ev => setEditData(d => ({ ...d, location: ev.target.value }))} style={selectStyle}>
                      {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                    </select>
                    <button onClick={() => saveEdit('investment')} style={buttonStyle}>Kaydet</button>
                    <button onClick={() => setEditingId(null)} style={{ ...buttonStyle, background: '#333' }}>İptal</button>
                  </div>
                </div>
              ) : (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', background: '#222', borderRadius: '6px', padding: '3px 8px', color: '#888', flexShrink: 0 }}>{i.location}</span>
                  <span style={{ fontSize: '13px', color: '#ccc', flex: 1 }}>
                    {Number(i.quantity).toLocaleString('tr-TR', { maximumFractionDigits: 6 })} {g.unit}
                  </span>
                  <span style={{ fontSize: '13px', color: '#888' }}>₺{Math.round(getTRYValue(i)).toLocaleString('tr-TR')}</span>
                  <span onClick={() => startEdit(i, 'investment')} style={{ color: '#666', cursor: 'pointer', fontSize: '13px' }}>✏️</span>
                  <span onClick={() => deleteInvestment(i.id)} style={{ color: '#444', cursor: 'pointer', fontSize: '13px' }}>✕</span>
                </div>
              ))}
            </div>
          ))}

          {investments.length === 0 && (
            <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: '14px' }}>Henüz yatırım eklenmedi.</p>
            </div>
          )}

          {investments.length > 0 && (
            <div style={{ marginTop: '16px', padding: '14px', background: '#1a1a2e', border: '1px solid #6366f1', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#ccc', fontSize: '13px', fontWeight: '600' }}>Toplam Portföy</span>
              <span style={{ color: '#fff', fontWeight: '700', fontSize: '18px' }}>₺{Math.round(investTotal).toLocaleString('tr-TR')}</span>
            </div>
          )}
        </div>
      )}

      {/* Gelir & Projeksiyon */}
      {tab === 'income' && (
        <div style={{ maxWidth: '780px' }}>
          <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>{currentMonth} — maaş günü: her ayın 5'i</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input value={incomeInput} onChange={e => setIncomeInput(e.target.value)} placeholder="₺ Aylık maaş" type="number" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div onClick={() => setUseBalance(!useBalance)} style={{ width: '18px', height: '18px', borderRadius: '5px', border: '2px solid', borderColor: useBalance ? '#6366f1' : '#555', background: useBalance ? '#6366f1' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {useBalance && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <span style={{ fontSize: '13px', color: '#888' }}>Maaş yerine mevcut bakiyemi kullan</span>
            </div>
            {useBalance && (
              <input value={balanceInput} onChange={e => setBalanceInput(e.target.value)} placeholder="₺ Mevcut bakiye" type="number" style={{ ...inputStyle, marginBottom: '8px' }} />
            )}
            <button onClick={saveIncome} style={buttonStyle}>Kaydet</button>
          </div>

          {totalIncome > 0 && (
            <div style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>Bu Ay</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: '#666', fontSize: '13px' }}>Aylık Maaş</span>
                <span style={{ color: '#6ee7b7', fontWeight: '700' }}>₺{totalIncome.toLocaleString('tr-TR')}</span>
              </div>
              {useBalance && income?.balance && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: '#666', fontSize: '13px' }}>Mevcut Bakiye (baz alınan)</span>
                  <span style={{ color: '#a78bfa', fontWeight: '700' }}>₺{Number(income.balance).toLocaleString('tr-TR')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: '#666', fontSize: '13px' }}>Sabit Giderler</span>
                <span style={{ color: '#f87171' }}>− ₺{totalRecurring.toLocaleString('tr-TR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: '#666', fontSize: '13px' }}>Değişken Bütçe</span>
                <span style={{ color: '#fbbf24' }}>− ₺{totalVariable.toLocaleString('tr-TR')}</span>
              </div>
              <div style={{ borderTop: '1px solid #333', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#ccc', fontSize: '13px' }}>Kullanılabilir Bütçe</span>
                <span style={{ color: '#fff', fontWeight: '700' }}>₺{(baseAmount - totalRecurring - totalVariable).toLocaleString('tr-TR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#ccc', fontSize: '13px' }}>Günlük Limit ({remainingDays} gün kaldı)</span>
                <span style={{ color: '#6366f1', fontWeight: '700', fontSize: '16px' }}>₺{dailyBudget.toLocaleString('tr-TR')}</span>
              </div>
            </div>
          )}

          {totalIncome > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>3 Aylık Projeksiyon (maaş baz)</div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {projection.map((p, i) => (
                  <div key={i} style={{ flex: 1, minWidth: '200px', background: i === 0 ? '#1a1a2e' : '#161616', border: i === 0 ? '1px solid #6366f1' : '1px solid #222', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: i === 0 ? '#6366f1' : '#555', fontWeight: '600', marginBottom: '12px' }}>{p.label} {i === 0 ? '(bu ay)' : ''}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#666' }}>Gelir</span>
                      <span style={{ fontSize: '12px', color: '#6ee7b7' }}>₺{p.income.toLocaleString('tr-TR')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#666' }}>Sabit Gider</span>
                      <span style={{ fontSize: '12px', color: '#f87171' }}>− ₺{p.recurring.toLocaleString('tr-TR')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#666' }}>Değişken</span>
                      <span style={{ fontSize: '12px', color: '#fbbf24' }}>− ₺{p.variable.toLocaleString('tr-TR')}</span>
                    </div>
                    <div style={{ borderTop: '1px solid #222', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: '#ccc' }}>Serbest</span>
                      <span style={{ fontSize: '14px', color: p.free >= 0 ? '#fff' : '#f87171', fontWeight: '700' }}>₺{p.free.toLocaleString('tr-TR')}</span>
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
        <Modal onClose={() => { setShowAddInv(false); setInvAssetType(null); setInvSelectedSymbol(null) }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Yatırım Ekle</h3>

          {!invAssetType ? (
            <>
              <p style={{ fontSize: '13px', color: '#666', marginBottom: '14px' }}>Ne eklemek istiyorsun?</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {ASSET_TYPES.map(at => (
                  <button key={at.key} onClick={() => setInvAssetType(at)} style={{
                    padding: '12px', background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px',
                    color: '#fff', textAlign: 'left', cursor: 'pointer'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>{at.name}</div>
                    <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{at.category}</div>
                  </button>
                ))}
              </div>
            </>
          ) : invAssetType.needsSymbol && !invSelectedSymbol ? (
            <>
              <div style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600' }}>{invAssetType.name}</div>
                <button onClick={() => setInvAssetType(null)} style={{ background: 'transparent', border: 'none', color: '#6366f1', fontSize: '12px', cursor: 'pointer', padding: '4px 0 0' }}>← Geri</button>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input value={invSearch} onChange={e => setInvSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchInvSymbol()}
                  placeholder={invAssetType.key === 'CRYPTO' ? 'BTC, ETH, SOL...' : 'Apple, AAPL, TSLA...'}
                  style={inputStyle} autoFocus />
                <button onClick={searchInvSymbol} style={buttonStyle}>{invSearching ? '...' : 'Ara'}</button>
              </div>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {invResults.map((r, i) => (
                  <div key={i} onClick={() => setInvSelectedSymbol(r)} style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>{r.symbol}</span>
                      <span style={{ fontSize: '11px', color: '#555' }}>{r.exchange || r.instrument_type}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{r.instrument_name}</div>
                  </div>
                ))}
                {invResults.length === 0 && !invSearching && <p style={{ color: '#555', fontSize: '13px' }}>Aramak için yukarıya yazın.</p>}
              </div>
            </>
          ) : (
            <>
              <div style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>
                  {invAssetType.needsSymbol ? invSelectedSymbol.symbol : invAssetType.name}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {invAssetType.needsSymbol ? invSelectedSymbol.instrument_name : `Birim: ${invAssetType.unit}`}
                </div>
                <button onClick={() => { if (invAssetType.needsSymbol) setInvSelectedSymbol(null); else setInvAssetType(null) }} style={{ background: 'transparent', border: 'none', color: '#6366f1', fontSize: '12px', cursor: 'pointer', padding: '4px 0 0' }}>← Değiştir</button>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>
                  {invAssetType.key === 'TRY' ? 'Tutar (₺)' :
                   invAssetType.key === 'GOLD_GRAM' || invAssetType.key === 'SILVER_GRAM' ? 'Gram' :
                   invAssetType.key === 'GOLD_QUARTER' ? 'Çeyrek altın adedi' :
                   invAssetType.key === 'GOLD_HALF' ? 'Yarım altın adedi' :
                   invAssetType.key === 'GOLD_FULL' ? 'Tam altın adedi' :
                   invAssetType.key === 'USD' ? 'Dolar miktarı ($)' :
                   invAssetType.key === 'EUR' ? 'Euro miktarı (€)' :
                   invAssetType.key === 'GBP' ? 'Sterlin miktarı (£)' :
                   'Adet'}
                </label>
                <input value={invQty} onChange={e => setInvQty(e.target.value)} type="number" step="0.000001" placeholder="0" style={{ ...inputStyle, width: '100%' }} autoFocus />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Konum</label>
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

function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '24px', width: '480px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#555', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        {children}
      </div>
    </div>
  )
}

function SummaryCard({ title, value, sub, percent, color }) {
  return (
    <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '16px', minWidth: '200px', flex: 1 }}>
      <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>{title}</div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#555', marginBottom: percent !== undefined ? '10px' : '0' }}>{sub}</div>
      {percent !== undefined && (
        <div style={{ background: '#222', borderRadius: '99px', height: '4px' }}>
          <div style={{ width: `${percent}%`, height: '4px', borderRadius: '99px', background: color, transition: 'width 0.3s' }} />
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  flex: 1, padding: '9px 12px', background: '#1a1a1a',
  border: '1px solid #2a2a2a', borderRadius: '8px',
  color: '#fff', fontSize: '14px', outline: 'none'
}
const selectStyle = {
  padding: '9px 12px', background: '#1a1a1a',
  border: '1px solid #2a2a2a', borderRadius: '8px',
  color: '#fff', fontSize: '14px', outline: 'none'
}
const buttonStyle = {
  padding: '9px 18px', background: '#6366f1',
  border: 'none', borderRadius: '8px',
  color: '#fff', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap'
}

export default Finance