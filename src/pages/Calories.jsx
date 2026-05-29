import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BACKEND } from '../config'

const MEALS = ['Kahvaltı', 'Öğle', 'Akşam', 'Atıştırmalık']

function Calories() {
  const [entries, setEntries] = useState([])
  const [goal, setGoal] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedMeal, setSelectedMeal] = useState('Kahvaltı')

  // Arama
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // Hedef formu
  const [showGoal, setShowGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')

  useEffect(() => { fetchEntries(); fetchGoal() }, [selectedDate])

  async function fetchEntries() {
    const { data, error } = await supabase
      .from('food_entries')
      .select('*')
      .eq('date', selectedDate)
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
    } catch (err) {
      console.error(err)
    } finally {
      setSearching(false)
    }
  }

  async function addFood(food, quantity) {
    const factor = quantity / 100
    await supabase.from('food_entries').insert({
      date: selectedDate,
      meal: selectedMeal,
      name: food.name,
      calories: Math.round(food.calories * factor),
      protein: Math.round(food.protein * factor),
      carbs: Math.round(food.carbs * factor),
      fat: Math.round(food.fat * factor),
      quantity
    })
    setShowSearch(false)
    setSearch('')
    setResults([])
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
    setShowGoal(false)
    fetchGoal()
  }

  const totalCalories = entries.reduce((s, e) => s + Number(e.calories), 0)
  const totalProtein = entries.reduce((s, e) => s + Number(e.protein || 0), 0)
  const totalCarbs = entries.reduce((s, e) => s + Number(e.carbs || 0), 0)
  const totalFat = entries.reduce((s, e) => s + Number(e.fat || 0), 0)
  const goalCalories = goal?.daily_calories || 2000
  const percent = Math.min((totalCalories / goalCalories) * 100, 100)

  return (
    <div style={{ color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700' }}>Kalori</h2>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          style={{ ...inputStyle, flex: 0, width: '160px', fontSize: '13px', marginLeft: 'auto' }} />
        <button onClick={() => setShowGoal(true)} style={{ ...buttonStyle, background: '#222', fontSize: '13px' }}>⚙ Hedef</button>
      </div>

      {/* Özet kart */}
      <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '20px', marginBottom: '24px', maxWidth: '680px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
          <span style={{ fontSize: '28px', fontWeight: '700' }}>{totalCalories}</span>
          <span style={{ fontSize: '14px', color: '#555' }}>/ {goalCalories} kcal</span>
        </div>
        <div style={{ background: '#222', borderRadius: '99px', height: '8px', marginBottom: '16px' }}>
          <div style={{ width: `${percent}%`, height: '8px', borderRadius: '99px', background: percent > 100 ? '#f87171' : percent > 85 ? '#fbbf24' : '#6ee7b7', transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <MacroBox label="Protein" value={totalProtein} color="#60a5fa" />
          <MacroBox label="Karb" value={totalCarbs} color="#fbbf24" />
          <MacroBox label="Yağ" value={totalFat} color="#f472b6" />
        </div>
      </div>

      {/* Öğünler */}
      <div style={{ maxWidth: '680px' }}>
        {MEALS.map(meal => {
          const mealEntries = entries.filter(e => e.meal === meal)
          const mealTotal = mealEntries.reduce((s, e) => s + Number(e.calories), 0)
          return (
            <div key={meal} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#ccc' }}>{meal}</span>
                  <span style={{ fontSize: '12px', color: '#555' }}>{mealTotal} kcal</span>
                </div>
                <button onClick={() => { setSelectedMeal(meal); setShowSearch(true) }} style={{ ...buttonStyle, padding: '5px 12px', fontSize: '12px' }}>+ Ekle</button>
              </div>
              {mealEntries.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: '#ccc', flex: 1 }}>{e.name}</span>
                  <span style={{ fontSize: '12px', color: '#555' }}>{e.quantity}g</span>
                  <span style={{ fontSize: '13px', color: '#fff', fontWeight: '600' }}>{e.calories} kcal</span>
                  <span onClick={() => deleteEntry(e.id)} style={{ color: '#444', cursor: 'pointer', fontSize: '13px' }}>✕</span>
                </div>
              ))}
              {mealEntries.length === 0 && <p style={{ color: '#444', fontSize: '13px' }}>Henüz bir şey eklenmedi.</p>}
            </div>
          )
        })}
      </div>

      {/* Arama Modal */}
      {showSearch && (
        <Modal onClose={() => setShowSearch(false)}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>{selectedMeal} — Yemek Ekle</h3>
          <p style={{ fontSize: '12px', color: '#555', marginBottom: '16px' }}>Besin değerleri 100g içindir</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchFood()} placeholder="Yemek ara (örn. yumurta, tavuk)..." style={inputStyle} autoFocus />
            <button onClick={searchFood} style={buttonStyle}>{searching ? '...' : 'Ara'}</button>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {results.map((food, i) => (
              <FoodResult key={i} food={food} onAdd={addFood} />
            ))}
            {results.length === 0 && !searching && <p style={{ color: '#555', fontSize: '14px' }}>Aramak için yukarıya yazın.</p>}
          </div>
        </Modal>
      )}

      {/* Hedef Modal */}
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
    <div style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#ccc' }}>{food.name}</div>
          {food.brand && <div style={{ fontSize: '11px', color: '#555' }}>{food.brand}</div>}
        </div>
        <div style={{ fontSize: '13px', color: '#fff', fontWeight: '600', whiteSpace: 'nowrap' }}>{food.calories} kcal</div>
      </div>
      <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#666', marginBottom: '10px' }}>
        <span>P: {food.protein}g</span>
        <span>K: {food.carbs}g</span>
        <span>Y: {food.fat}g</span>
        <span style={{ color: '#444' }}>(100g)</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} style={{ ...inputStyle, flex: 0, width: '80px', fontSize: '13px', padding: '6px 8px' }} />
        <span style={{ fontSize: '12px', color: '#555' }}>gram</span>
        <span style={{ fontSize: '12px', color: '#888', marginLeft: 'auto' }}>= {Math.round(food.calories * qty / 100)} kcal</span>
        <button onClick={() => onAdd(food, qty)} style={{ ...buttonStyle, padding: '6px 14px', fontSize: '13px' }}>Ekle</button>
      </div>
    </div>
  )
}

function MacroBox({ label, value, color }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: '600', color }}>{value}g</div>
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '24px', width: '500px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#555', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        {children}
      </div>
    </div>
  )
}

const inputStyle = {
  flex: 1, padding: '9px 12px', background: '#1a1a1a',
  border: '1px solid #2a2a2a', borderRadius: '8px',
  color: '#fff', fontSize: '14px', outline: 'none'
}
const buttonStyle = {
  padding: '9px 18px', background: '#6366f1',
  border: 'none', borderRadius: '8px',
  color: '#fff', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap'
}

export default Calories