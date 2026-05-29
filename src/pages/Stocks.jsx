import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BACKEND } from '../config'

function Stocks() {
  const [holdings, setHoldings] = useState([])
  const [quotes, setQuotes] = useState({})
  const [loading, setLoading] = useState(true)

  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [searchType, setSearchType] = useState('stock')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [qty, setQty] = useState('')
  const [buyPrice, setBuyPrice] = useState('')

  useEffect(() => { fetchHoldings() }, [])

  async function fetchHoldings() {
    const { data, error } = await supabase.from('holdings').select('*').order('created_at', { ascending: true })
    if (!error) {
      setHoldings(data)
      if (data.length > 0) fetchQuotes(data)
    }
    setLoading(false)
  }

  async function fetchQuotes(items) {
    const symbols = [...new Set(items.map(h => h.symbol))].join(',')
    try {
      const res = await fetch(`${BACKEND}/api/quote?symbols=${encodeURIComponent(symbols)}`)
      const data = await res.json()
      setQuotes(data)
    } catch (err) {
      console.error(err)
    }
  }

  async function searchSymbol() {
    if (!search.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`${BACKEND}/api/symbol-search?q=${encodeURIComponent(search)}&type=${searchType}`)
      const data = await res.json()
      setResults(data.results || [])
    } catch (err) {
      console.error(err)
    } finally {
      setSearching(false)
    }
  }

  async function addHolding() {
    if (!selected || !qty || !buyPrice) return
    await supabase.from('holdings').insert({
      symbol: selected.symbol,
      name: selected.instrument_name || selected.symbol,
      type: selected.instrument_type || 'Hisse',
      quantity: Number(qty),
      buy_price: Number(buyPrice)
    })
    setShowAdd(false); setSelected(null); setSearch(''); setResults([]); setQty(''); setBuyPrice('')
    fetchHoldings()
  }

  async function deleteHolding(id) {
    await supabase.from('holdings').delete().eq('id', id)
    fetchHoldings()
  }

  let totalValue = 0, totalCost = 0
  holdings.forEach(h => {
    const price = parseFloat(quotes[h.symbol]?.close || 0)
    totalValue += price * h.quantity
    totalCost += h.buy_price * h.quantity
  })
  const totalPL = totalValue - totalCost
  const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0

  if (loading) return <div style={{ color: '#555' }}>Yükleniyor...</div>

  return (
    <div style={{ color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700' }}>Borsa</h2>
        <button onClick={() => fetchHoldings()} style={{ ...buttonStyle, background: '#222', fontSize: '13px', marginLeft: 'auto' }}>↻ Yenile</button>
        <button onClick={() => setShowAdd(true)} style={{ ...buttonStyle, fontSize: '13px' }}>+ Ekle</button>
      </div>

      {holdings.length > 0 && (
        <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '20px', marginBottom: '24px', maxWidth: '760px' }}>
          <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Toplam Portföy</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '28px', fontWeight: '700' }}>${totalValue.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
            <span style={{ fontSize: '15px', fontWeight: '600', color: totalPL >= 0 ? '#6ee7b7' : '#f87171' }}>
              {totalPL >= 0 ? '+' : ''}{totalPL.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} $ ({totalPLPercent >= 0 ? '+' : ''}{totalPLPercent.toFixed(2)}%)
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>Maliyet: ${totalCost.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</div>
        </div>
      )}

      <div style={{ maxWidth: '760px' }}>
        {holdings.map(h => {
          const q = quotes[h.symbol]
          const price = parseFloat(q?.close || 0)
          const change = parseFloat(q?.percent_change || 0)
          const value = price * h.quantity
          const cost = h.buy_price * h.quantity
          const pl = value - cost
          const plPercent = cost > 0 ? (pl / cost) * 100 : 0

          return (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#1a1a1a', border: '1px solid #222', borderRadius: '10px', padding: '14px 16px', marginBottom: '8px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>{h.symbol}</span>
                  <span style={{ fontSize: '10px', background: '#222', borderRadius: '4px', padding: '2px 6px', color: '#888' }}>{h.type}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{h.quantity} adet · alış ${h.buy_price}</div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>${price.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</div>
                <div style={{ fontSize: '11px', color: change >= 0 ? '#6ee7b7' : '#f87171' }}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</div>
              </div>

              <div style={{ textAlign: 'right', minWidth: '120px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</div>
                <div style={{ fontSize: '11px', color: pl >= 0 ? '#6ee7b7' : '#f87171' }}>
                  {pl >= 0 ? '+' : ''}{pl.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ({plPercent >= 0 ? '+' : ''}{plPercent.toFixed(1)}%)
                </div>
              </div>

              <span onClick={() => deleteHolding(h.id)} style={{ color: '#444', cursor: 'pointer', fontSize: '14px' }}>✕</span>
            </div>
          )
        })}
        {holdings.length === 0 && <p style={{ color: '#555', fontSize: '14px' }}>Henüz varlık eklenmedi.</p>}
      </div>

      {showAdd && (
        <Modal onClose={() => { setShowAdd(false); setSelected(null) }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>Varlık Ekle</h3>

          {!selected ? (
            <>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                {[['stock', 'Hisse'], ['crypto', 'Kripto'], ['forex', 'Döviz/Altın']].map(([val, label]) => (
                  <button key={val} onClick={() => { setSearchType(val); setResults([]) }} style={{
                    padding: '5px 12px', borderRadius: '20px', border: '1px solid',
                    borderColor: searchType === val ? '#6366f1' : '#2a2a2a',
                    background: searchType === val ? '#6366f1' : 'transparent',
                    color: searchType === val ? '#fff' : '#666', fontSize: '12px', cursor: 'pointer'
                  }}>{label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchSymbol()}
                  placeholder={searchType === 'crypto' ? 'BTC, ETH...' : searchType === 'forex' ? 'EUR, XAU (altın)...' : 'Apple, AAPL...'}
                  style={inputStyle} autoFocus />
                <button onClick={searchSymbol} style={buttonStyle}>{searching ? '...' : 'Ara'}</button>
              </div>
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {results.map((r, i) => (
                  <div key={i} onClick={() => setSelected(r)} style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>{r.symbol}</span>
                      <span style={{ fontSize: '11px', color: '#555' }}>{r.exchange || r.instrument_type}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{r.instrument_name}</div>
                  </div>
                ))}
                {results.length === 0 && !searching && (
                  <p style={{ color: '#555', fontSize: '13px' }}>
                    {searchType === 'crypto' ? 'Kripto ara (örn. BTC, ETH)' : searchType === 'forex' ? 'Döviz/altın ara (örn. EUR, GBP, XAU)' : 'Hisse ara (örn. AAPL, TSLA)'}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>{selected.symbol}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{selected.instrument_name}</div>
                <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: '#6366f1', fontSize: '12px', cursor: 'pointer', padding: '4px 0 0' }}>← Değiştir</button>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Adet</label>
                  <input value={qty} onChange={e => setQty(e.target.value)} type="number" placeholder="10" style={{ ...inputStyle, width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#555', display: 'block', marginBottom: '4px' }}>Alış Fiyatı ($)</label>
                  <input value={buyPrice} onChange={e => setBuyPrice(e.target.value)} type="number" placeholder="150" style={{ ...inputStyle, width: '100%' }} />
                </div>
              </div>
              <button onClick={addHolding} style={{ ...buttonStyle, width: '100%' }}>Portföye Ekle</button>
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

export default Stocks