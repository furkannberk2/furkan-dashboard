import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BACKEND } from '../config'

const MEALS = ['Kahvaltı', 'Öğle', 'Akşam', 'Atıştırmalık']

function Calories() {
  const [entries, setEntries] = useState([])
  const [goal, setGoal] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedMeal, setSelectedMeal] = useState('Kahvaltı')

  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  const [showGoal, setShowGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')

  useEffect(() => { fetchEntries(); fetchGoal() }, [selectedDate])

  async function fetchEntries() {
    const { data, error } = await supabase
      .from('food_entries').select('*').eq('date', selectedDate)
      .order('created_at', { ascending: true })
    if (!error) setEntries(data)
  }

  async function fetchGoal() {
    const { data, error } = await supabase.from('calorie_goals').select('*').limit(1).single()
    if (!error && data) { setGoal(data); setGoalInput(data.daily_calories) }
  }

  async function searchFood() {
    if (!search.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`${BACKEND}/api/food-search?q=${encodeURIComponent(search)}`)
      const data = await res.json()
      setResults(data.products || [])
    } catch (err) { console.error(err) }
    finally { setSearching(false) }
  }

  async function addFood(food, quantity) {
    const factor = quantity / 100
    await supabase.from('food_entries').insert({
      date: selectedDate, meal: selectedMeal, name: food.name,
      calories: Math.round(food.calories * factor),
      protein: Math.round(food.protein * factor),
      carbs: Math.round(food.carbs * factor),
      fat: Math.round(food.fat * factor),
      quantity
    })
    setShowSearch(false); setSearch(''); setResults([])
    fetchEntries()
  }

  async function deleteEntry(id) {
    await supabase.from('food_entries').delete().eq('id', id)
    fetchEntries()
  }

  async function saveGoal() {
    if (!goalInput) return
    if (goal) {
      await supabase.from('calorie_goals').update({ daily_calories: Number(goalInput), updated_at: new Date() }).eq('id', goal.id)
    } else {
      await supabase.from('calorie_goals').insert({ daily_calories: Number(goalInput) })
    }
    setShowGoal(false); fetchGoal()
  }

  const totalCalories = entries.reduce((s, e) => s + Number(e.calories), 0)
  const totalProtein = entries.reduce((s, e) => s + Number(e.protein || 0), 0)
  const totalCarbs = entries.reduce((s, e) => s + Number(e.carbs || 0), 0)
  const totalFat = entries.reduce((s, e) => s + Number(e.fat || 0), 0)
  const goalCalories = goal?.daily_calories || 2000
  const percent = Math.min((totalCalories / goalCalories) * 100, 100)

  return (
    <div style={{ color: 'var(--text)' }}>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '12px' }}>Kalori</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: '140px', maxWidth: '200px', fontSize: '13px' }} />
          <button onClick={() => setShowGoal(true)} style={{ ...buttonStyle, background: 'var(--bg-item)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '13px' }}>⚙ Hedef</button>
        </div>
      </div>

      {/* Özet kart */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px', marginBottom: '20px', maxWidth: '680px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
          <span style={{ fontSize: '28px', fontWeight: '700' }}>{totalCalories}</span>
          <span style={{ fontSize: '14px', color: 'var(--text-faint)' }}>/ {goalCalories} kcal</span>
        </div>
        <div style={{ background: 'var(--bg-item)', borderRadius: '99px', height: '8px', marginBottom: '16px' }}>
          <div style={{ width: `${percent}%`, height: '8px', borderRadius: '99px', background: percent > 100 ? 'var(--danger)' : percent > 85 ? 'var(--warning)' : 'var(--success)', transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <MacroBox label="Protein" value={totalProtein} color="var(--info)" />
          <MacroBox label="Karb" value={totalCarbs} color="var(--warning)" />
          <MacroBox label="Yağ" value={totalFat} color="var(--pink)" />
        </div>
      </div>

      {/* Öğünler */}
      <div style={{ maxWidth: '680px' }}>
        {MEALS.map(meal => {
          const mealEntries = entries.filter(e => e.meal === meal)
          const mealTotal = mealEntries.reduce((s, e) => s + Number(e.calories), 0)
          return (
            <div key={meal} style={{ marginBottom: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mealEntries.length > 0 ? '10px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>{meal}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{mealTotal} kcal</span>
                </div>
                <button onClick={() => { setSelectedMeal(meal); setShowSearch(true) }} style={{ ...buttonStyle, padding: '5px 12px', fontSize: '12px' }}>+ Ekle</button>
              </div>
              {mealEntries.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-faint)', flexShrink: 0 }}>{e.quantity}g</span>
                  <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: '600', flexShrink: 0 }}>{e.calories}</span>
                  <span onClick={() => deleteEntry(e.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>✕</span>
                </div>
              ))}
              {mealEntries.length === 0 && <p style={{ color: 'var(--text-faded)', fontSize: '12px', margin: '6px 0 0' }}>Boş</p>}
            </div>
          )
        })}
      </div>

      {showSearch && (
        <Modal onClose={() => setShowSearch(false)}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>{selectedMeal} — Yemek Ekle</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginBottom: '14px' }}>Besin değerleri 100g içindir</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchFood()} placeholder="Yemek ara (örn. yumurta, tavuk)..." style={inputStyle} autoFocus />
            <button onClick={searchFood} style={buttonStyle}>{searching ? '...' : 'Ara'}</button>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {results.map((food, i) => <FoodResult key={i} food={food} onAdd={addFood} />)}
            {results.length === 0 && !searching && <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>Aramak için yukarıya yazın.</p>}
          </div>
        </Modal>
      )}

      {showGoal && (
        <Modal onClose={() => setShowGoal(false)}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Günlük Kalori Hedefi</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input value={goalInput} onChange={e => setGoalInput(e.target.value)} type="number" placeholder="2000" style={inputStyle} />
            <button onClick={saveGoal} style={buttonStyle}>Kaydet</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function FoodResult({ food, onAdd }) {
  const [qty, setQty] = useState(100)
  return (
    <div style={{ background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{food.name}</div>
          {food.brand && <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{food.brand}</div>}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: '600', whiteSpace: 'nowrap', marginLeft: '8px' }}>{food.calories} kcal</div>
      </div>
      <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '10px' }}>
        <span>P: {food.protein}g</span>
        <span>K: {food.carbs}g</span>
        <span>Y: {food.fat}g</span>
        <span style={{ color: 'var(--text-faded)' }}>(100g)</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} style={{ ...inputStyle, flex: 0, width: '70px', fontSize: '13px', padding: '6px 8px' }} />
        <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>gram</span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>= {Math.round(food.calories * qty / 100)} kcal</span>
        <button onClick={() => onAdd(food, qty)} style={{ ...buttonStyle, padding: '6px 14px', fontSize: '13px' }}>Ekle</button>
      </div>
    </div>
  )
}

function MacroBox({ label, value, color }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: '600', color }}>{value}g</div>
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '20px', width: '500px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '14px', right: '14px', background: 'transparent', border: 'none', color: 'var(--text-faint)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        {children}
      </div>
    </div>
  )
}

const inputStyle = {
  flex: 1, padding: '9px 12px', background: 'var(--bg-item)',
  border: '1px solid var(--border-strong)', borderRadius: '8px',
  color: 'var(--text)', fontSize: '14px', outline: 'none'
}
const buttonStyle = {
  padding: '9px 16px', background: 'var(--accent)',
  border: 'none', borderRadius: '8px',
  color: '#fff', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap'
}

export default Calories