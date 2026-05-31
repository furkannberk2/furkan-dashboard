import { useAuth } from '../components/AuthProvider'

function Login() {
  const { signInWithGoogle } = useAuth()

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', color: 'var(--text)'
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '32px',
        width: '100%', maxWidth: '380px', textAlign: 'center'
      }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '14px',
          background: 'var(--accent)', margin: '0 auto 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: '24px', fontWeight: '700'
        }}>F</div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>Dashboard'a Hoş Geldin</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-faint)', marginBottom: '26px', lineHeight: '1.6' }}>
          Görevler, alışkanlıklar, finans ve daha fazlasını tek yerden yönet.
        </p>
        <button onClick={signInWithGoogle} style={{
          width: '100%', padding: '11px 16px',
          background: 'var(--bg-item)', border: '1px solid var(--border-strong)',
          borderRadius: '10px', color: 'var(--text)',
          fontSize: '14px', fontWeight: '500', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Google ile giriş yap
        </button>
      </div>
    </div>
  )
}

export default Login