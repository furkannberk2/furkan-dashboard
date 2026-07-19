import { useAuth } from '../components/AuthProvider'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BACKEND } from '../config'

const TYPE_LABELS = {
  'BIST': 'BIST',
  'crypto': 'Kripto',
  'forex': 'Döviz',
  'Hisse': 'ABD Hisse',
  'Common Stock': 'ABD Hisse'
}

// Ham type'ı gruplama kategorisine indirger
function getCategory(type) {
  if (type === 'BIST') return 'BIST'
  if (type === 'crypto' || type === 'Digital Currency' || type === 'Cryptocurrency') return 'Kripto'
  if (type === 'forex' || type === 'Physical Currency') return 'Döviz'
  return 'ABD Hisse'
}

const CATEGORY_ORDER = ['BIST', 'ABD Hisse', 'Kripto', 'Döviz']

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth <= 768)
  useEffect(() => {
    const h = () => setM(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}

// Basit SVG sparkline
function Sparkline({ data, color }) {
  if (!data || data.length < 2) return <div style={{ width: '80px', height: '28px' }} />
  const w = 80, h = 28, pad = 2
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = pad + (1 - (v - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} style={{ flexShrink: 0 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Stocks() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [holdings, setHoldings] = useState([])
  const [quotes, setQuotes] = useState({})
  const [monthly, setMonthly] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')

  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [searchType, setSearchType] = useState('stock')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

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
    const uniqueItems = [...new Map(items.map(h => [h.symbol, h])).values()]
    const symbols = uniqueItems.map(h => h.symbol).join(',')
    const hints = uniqueItems.map(h => h.type === 'BIST' ? 'BIST' : '').join(',')
    try {
      const res = await fetch(`${BACKEND}/api/quote?symbols=${encodeURIComponent(symbols)}&hints=${encodeURIComponent(hints)}&history=1`)
      const data = await res.json()
      setQuotes(data)
      const monthlyData = {}
      Object.entries(data).forEach(([sym, val]) => {
        monthlyData[sym] = { monthly_change: val.monthly_change, sparkline: val.sparkline }
      })
      setMonthly(monthlyData)
    } catch (err) { console.error(err) }
  }

  async function searchSymbol() {
    if (!search.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`${BACKEND}/api/symbol-search?q=${encodeURIComponent(search)}&type=${searchType}`)
      const data = await res.json()
      setResults(data.results || [])
    } catch (err) { console.error(err) }
    finally { setSearching(false) }
  }

  async function addToWatchlist(r) {
    await supabase.from('holdings').insert({
      symbol: r.symbol,
      name: r.instrument_name || r.symbol,
      type: r.exchange === 'BIST' ? 'BIST' : (searchType === 'crypto' ? 'crypto' : searchType === 'forex' ? 'forex' : (r.instrument_type || 'Hisse')),
      quantity: 0,
      buy_price: 0,
      user_id: user.id
    })
    setShowAdd(false); setSearch(''); setResults([])
    fetchHoldings()
  }

  async function deleteHolding(id) {
    await supabase.from('holdings').delete().eq('id', id)
    fetchHoldings()
  }

  function refresh() {
    if (holdings.length > 0) fetchQuotes(holdings)
  }

  if (loading) return <div style={{ color: 'var(--text-faint)' }}>Yükleniyor...</div>

  // Kategorilere göre grupla
  const groupedByCategory = {}
  holdings.forEach(h => {
    const cat = getCategory(h.type)
    if (!groupedByCategory[cat]) groupedByCategory[cat] = []
    groupedByCategory[cat].push(h)
  })

  // Mevcut kategoriler (veri olanlar), sıralı
  const availableCategories = CATEGORY_ORDER.filter(c => groupedByCategory[c]?.length > 0)

  // Filtreye göre gösterilecek kategoriler
  const visibleCategories = activeFilter === 'all'
    ? availableCategories
    : availableCategories.filter(c => c === activeFilter)

  return (
    <div style={{ color: 'var(--text)' }}>
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '6px' }}>İzleme Listesi</h2>
        <p style={{ fontSize: '12.5px', color: 'var(--text-faint)', marginBottom: '12px' }}>Takip etmek istediğin sembolleri ekle. Portföy için Finans → Yatırımlar'ı kullan.</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={refresh} style={{ ...buttonStyle, background: 'var(--bg-item)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '13px' }}>↻ Yenile</button>
          <button onClick={() => setShowAdd(true)} style={{ ...buttonStyle, fontSize: '13px', marginLeft: 'auto' }}>+ Ekle</button>
        </div>
      </div>

      {/* Filtre */}
      {availableCategories.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveFilter('all')} style={filterBtn(activeFilter === 'all')}>Tümü</button>
          {availableCategories.map(cat => (
            <button key={cat} onClick={() => setActiveFilter(cat)} style={filterBtn(activeFilter === cat)}>{cat}</button>
          ))}
        </div>
      )}

      <div style={{ maxWidth: '820px' }}>
        {visibleCategories.map(cat => (
          <div key={cat} style={{ marginBottom: '22px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '600', marginBottom: '10px' }}>
              {cat} ({groupedByCategory[cat].length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
              {groupedByCategory[cat].map(h => {
                const q = quotes[h.symbol]
                const price = parseFloat(q?.close || 0)
                const change = parseFloat(q?.percent_change || 0)
                const monthChange = monthly[h.symbol]?.monthly_change
                const sparkline = monthly[h.symbol]?.sparkline || []
                const currency = q?.currency || (h.type === 'BIST' ? 'TRY' : 'USD')
                const curSym = currency === 'TRY' ? '₺' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'
                const changeColor = change >= 0 ? 'var(--success)' : 'var(--danger)'

                return (
                  <div key={h.id} style={{ background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700' }}>{h.symbol}</span>
                      <span onClick={() => deleteHolding(h.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '13px', marginLeft: 'auto' }}>✕</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '17px', fontWeight: '700', marginBottom: '3px' }}>
                          {curSym}{price.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11.5px', color: changeColor, fontWeight: '600' }}>
                            {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                          </span>
                          {monthChange !== null && monthChange !== undefined && (
                            <span style={{ fontSize: '11.5px', color: parseFloat(monthChange) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                              30g: {parseFloat(monthChange) >= 0 ? '+' : ''}{monthChange}%
                            </span>
                          )}
                        </div>
                      </div>
                      <Sparkline data={sparkline} color={change >= 0 ? 'var(--success)' : 'var(--danger)'} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {holdings.length === 0 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>Henüz hiçbir sembol eklenmedi. + Ekle ile başla.</p>
          </div>
        )}
      </div>

      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '14px' }}>İzleme Listesine Ekle</h3>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {[['stock', 'ABD Hisse'], ['bist', 'BIST'], ['crypto', 'Kripto'], ['forex', 'Döviz']].map(([val, label]) => (
              <button key={val} onClick={() => { setSearchType(val); setResults([]) }} style={{
                padding: '5px 12px', borderRadius: '20px', border: '1px solid',
                borderColor: searchType === val ? 'var(--accent)' : 'var(--border-strong)',
                background: searchType === val ? 'var(--accent)' : 'transparent',
                color: searchType === val ? '#fff' : 'var(--text-dim)', fontSize: '12px', cursor: 'pointer'
              }}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchSymbol()}
              placeholder={searchType === 'crypto' ? 'BTC, ETH...' : searchType === 'forex' ? 'EUR, XAU (altın)...' : searchType === 'bist' ? 'THYAO, ASELS...' : 'Apple, AAPL...'}
              style={inputStyle} autoFocus />
            <button onClick={searchSymbol} style={buttonStyle}>{searching ? '...' : 'Ara'}</button>
          </div>
          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            {results.map((r, i) => (
              <div key={i} onClick={() => addToWatchlist(r)} style={{ background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>{r.symbol}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{r.exchange || r.instrument_type}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{r.instrument_name}</div>
              </div>
            ))}
            {results.length === 0 && !searching && (
              <p style={{ color: 'var(--text-faint)', fontSize: '13px' }}>
                {searchType === 'crypto' ? 'Kripto ara' : searchType === 'forex' ? 'Döviz/altın ara' : searchType === 'bist' ? 'BIST hissesi ara' : 'ABD hissesi ara'}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function filterBtn(active) {
  return {
    padding: '6px 14px', borderRadius: '20px', border: '1px solid',
    borderColor: active ? 'var(--accent)' : 'var(--border-strong)',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-dim)', fontSize: '13px', cursor: 'pointer'
  }
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

export default Stocks