import { useAuth } from '../components/AuthProvider'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BACKEND } from '../config'

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth <= 768)
  useEffect(() => {
    const h = () => setM(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}

function Stocks() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [holdings, setHoldings] = useState([])
  const [quotes, setQuotes] = useState({})
  const [monthly, setMonthly] = useState({})
  const [loading, setLoading] = useState(true)

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
      if (data.length > 0) {
        fetchQuotes(data)
        fetchMonthly(data)
      }
    }
    setLoading(false)
  }

  async function fetchQuotes(items) {
    const symbols = [...new Set(items.map(h => h.symbol))].join(',')
    try {
      const res = await fetch(`${BACKEND}/api/quote?symbols=${encodeURIComponent(symbols)}`)
      const data = await res.json()
      setQuotes(data)
    } catch (err) { console.error(err) }
  }

  async function fetchMonthly(items) {
    const symbols = [...new Set(items.map(h => h.symbol))].join(',')
    try {
      const res = await fetch(`${BACKEND}/api/monthly-change?symbols=${encodeURIComponent(symbols)}`)
      const data = await res.json()
      setMonthly(data)
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
      type: r.exchange === 'BIST' ? 'BIST' : (r.instrument_type || 'Hisse'),
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
    if (holdings.length > 0) {
      fetchQuotes(holdings)
      fetchMonthly(holdings)
    }
  }

  if (loading) return <div style={{ color: 'var(--text-faint)' }}>Yükleniyor...</div>

  return (
    <div style={{ color: 'var(--text)' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '6px' }}>İzleme Listesi</h2>
        <p style={{ fontSize: '12.5px', color: 'var(--text-faint)', marginBottom: '12px' }}>Takip etmek istediğin sembolleri ekle. Portföy için Finans → Yatırımlar'ı kullan.</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={refresh} style={{ ...buttonStyle, background: 'var(--bg-item)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '13px' }}>↻ Yenile</button>
          <button onClick={() => setShowAdd(true)} style={{ ...buttonStyle, fontSize: '13px', marginLeft: 'auto' }}>+ Ekle</button>
        </div>
      </div>

      <div style={{ maxWidth: '760px' }}>
        {holdings.map(h => {
          const q = quotes[h.symbol]
          const price = parseFloat(q?.close || 0)
          const change = parseFloat(q?.percent_change || 0)
          const monthChange = monthly[h.symbol]?.monthly_change
          const currency = q?.currency || (h.type === 'BIST' ? 'TRY' : 'USD')
          const symbol = currency === 'TRY' ? '₺' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'

          return (
            <div key={h.id} style={{ background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>{h.symbol}</span>
                  <span style={{ fontSize: '10px', background: 'var(--bg-card)', borderRadius: '4px', padding: '2px 6px', color: 'var(--text-muted)' }}>{h.type}</span>
                </div>
                <span onClick={() => deleteHolding(h.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '14px' }}>✕</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '18px', fontWeight: '700' }}>{symbol}{price.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</div>
                <div style={{ fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-faint)', marginRight: '4px' }}>Günlük:</span>
                  <span style={{ color: change >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                    {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                  </span>
                </div>
                {monthChange !== null && monthChange !== undefined && (
                  <div style={{ fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-faint)', marginRight: '4px' }}>Aylık:</span>
                    <span style={{ color: parseFloat(monthChange) >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                      {parseFloat(monthChange) >= 0 ? '+' : ''}{monthChange}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
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