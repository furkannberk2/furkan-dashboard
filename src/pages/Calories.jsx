import { useAuth } from '../components/AuthProvider'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { BACKEND } from '../config'
import { BrowserMultiFormatReader } from '@zxing/browser'

const MEALS = ['Kahvaltı', 'Öğle', 'Akşam', 'Atıştırmalık']

function Calories() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [goal, setGoal] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedMeal, setSelectedMeal] = useState('Kahvaltı')

  const [showAdd, setShowAdd] = useState(false)
  const [addMode, setAddMode] = useState('search') // 'search' | 'manual' | 'barcode'

  // Search
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  // Manual
  const [mName, setMName] = useState('')
  const [mCalories, setMCalories] = useState('')
  const [mQuantity, setMQuantity] = useState('100')
  const [mProtein, setMProtein] = useState('')
  const [mCarbs, setMCarbs] = useState('')
  const [mFat, setMFat] = useState('')

  // Barcode
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const [scanStatus, setScanStatus] = useState('') // '', 'scanning', 'found', 'error'
  const [scanResult, setScanResult] = useState(null)
  const [scanQty, setScanQty] = useState(100)

  const [showGoal, setShowGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')

  useEffect(() => { fetchEntries(); fetchGoal() }, [selectedDate])

  // Barkod tarayıcı kontrolü
  useEffect(() => {
    if (showAdd && addMode === 'barcode' && !scanResult) {
      startScan()
    } else {
      stopScan()
    }
    return () => stopScan()
  }, [showAdd, addMode, scanResult])

async function startScan() {
    setScanStatus('scanning')
    try {
      // Arka kamerayı tercih et
      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      const rearCamera = devices.find(d =>
        /back|rear|environment/i.test(d.label)
      ) || devices[devices.length - 1]
      const deviceId = rearCamera?.deviceId

      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader
      await reader.decodeFromVideoDevice(deviceId, videoRef.current, async (result, err) => {
        if (result) {
          const code = result.getText()
          stopScan()
          setScanStatus('found')
          try {
            const r = await fetch(`${BACKEND}/api/barcode?code=${code}`)
            const data = await r.json()
            if (data.product) {
              setScanResult(data.product)
            } else {
              setScanStatus('not_found')
            }
          } catch {
            setScanStatus('error')
          }
        }
      })
    } catch (err) {
      console.error(err)
      setScanStatus('error')
    }
  }

  function stopScan() {
    if (readerRef.current) {
      try { readerRef.current.reset() } catch {}
      readerRef.current = null
    }
  }

  function resetAdd() {
    setShowAdd(false)
    setSearch(''); setResults([])
    setMName(''); setMCalories(''); setMQuantity('100'); setMProtein(''); setMCarbs(''); setMFat('')
    setScanResult(null); setScanStatus(''); setScanQty(100)
    setAddMode('search')
  }

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
      quantity,
      user_id: user.id
    })
    resetAdd()
    fetchEntries()
  }

  async function addManual() {
    if (!mName.trim() || !mCalories) return
    await supabase.from('food_entries').insert({
      date: selectedDate, meal: selectedMeal, name: mName,
      calories: Number(mCalories),
      protein: mProtein ? Number(mProtein) : 0,
      carbs: mCarbs ? Number(mCarbs) : 0,
      fat: mFat ? Number(mFat) : 0,
      quantity: Number(mQuantity) || 1,
      user_id: user.id
    })
    resetAdd()
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
      await supabase.from('calorie_goals').insert({user_id: user.id, daily_calories: Number(goalInput) })
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
                <button onClick={() => { setSelectedMeal(meal); setShowAdd(true) }} style={{ ...buttonStyle, padding: '5px 12px', fontSize: '12px' }}>+ Ekle</button>
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

      {showAdd && (
        <Modal onClose={resetAdd}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '14px' }}>{selectedMeal} — Ekle</h3>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            {[['search', '🔍 Ara'], ['manual', '✏️ Manuel'], ['barcode', '📷 Barkod']].map(([val, label]) => (
              <button key={val} onClick={() => setAddMode(val)} style={{
                flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1px solid',
                borderColor: addMode === val ? 'var(--accent)' : 'var(--border-strong)',
                background: addMode === val ? 'var(--accent)' : 'transparent',
                color: addMode === val ? '#fff' : 'var(--text-dim)', fontSize: '12px', cursor: 'pointer'
              }}>{label}</button>
            ))}
          </div>

          {/* ARAMA */}
          {addMode === 'search' && (
            <>
              <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginBottom: '12px' }}>Besin değerleri 100g içindir</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchFood()} placeholder="Yemek ara..." style={inputStyle} autoFocus />
                <button onClick={searchFood} style={buttonStyle}>{searching ? '...' : 'Ara'}</button>
              </div>
              <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {results.map((food, i) => <FoodResult key={i} food={food} onAdd={addFood} />)}
                {results.length === 0 && !searching && <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>Aramak için yukarıya yazın.</p>}
              </div>
            </>
          )}

          {/* MANUEL */}
          {addMode === 'manual' && (
            <>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-faint)', display: 'block', marginBottom: '4px' }}>İsim</label>
                <input value={mName} onChange={e => setMName(e.target.value)} placeholder="örn. Pilav" style={{ ...inputStyle, width: '100%' }} autoFocus />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-faint)', display: 'block', marginBottom: '4px' }}>Kalori (kcal)</label>
                  <input value={mCalories} onChange={e => setMCalories(e.target.value)} type="number" placeholder="200" style={{ ...inputStyle, width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-faint)', display: 'block', marginBottom: '4px' }}>Miktar (gr/adet)</label>
                  <input value={mQuantity} onChange={e => setMQuantity(e.target.value)} type="number" placeholder="100" style={{ ...inputStyle, width: '100%' }} />
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '10px' }}>Makrolar (isteğe bağlı)</div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                <input value={mProtein} onChange={e => setMProtein(e.target.value)} type="number" placeholder="Protein (g)" style={{ ...inputStyle, fontSize: '13px' }} />
                <input value={mCarbs} onChange={e => setMCarbs(e.target.value)} type="number" placeholder="Karb (g)" style={{ ...inputStyle, fontSize: '13px' }} />
                <input value={mFat} onChange={e => setMFat(e.target.value)} type="number" placeholder="Yağ (g)" style={{ ...inputStyle, fontSize: '13px' }} />
              </div>
              <button onClick={addManual} style={{ ...buttonStyle, width: '100%' }}>Ekle</button>
            </>
          )}

          {/* BARKOD */}
          {addMode === 'barcode' && (
            <>
              {!scanResult ? (
                <div>
                  <div style={{ position: 'relative', background: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '10px' }}>
                    <video ref={videoRef} style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: '1px', background: 'var(--danger)', boxShadow: '0 0 8px var(--danger)' }} />
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-faint)', textAlign: 'center', margin: 0 }}>
                    {scanStatus === 'scanning' && '📷 Barkodu kameraya tut...'}
                    {scanStatus === 'found' && '⏳ Aranıyor...'}
                    {scanStatus === 'not_found' && '❌ Bu barkod veritabanında yok'}
                    {scanStatus === 'error' && '⚠️ Kameraya erişilemedi — tarayıcı izni gerekli'}
                  </p>
                  {(scanStatus === 'not_found' || scanStatus === 'error') && (
                    <button onClick={() => { setScanStatus(''); startScan() }} style={{ ...buttonStyle, width: '100%', marginTop: '10px' }}>Tekrar Dene</button>
                  )}
                </div>
              ) : (
                <FoodResult food={scanResult} onAdd={addFood} />
              )}
            </>
          )}
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