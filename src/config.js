import { supabase } from './lib/supabase'

export const BACKEND = import.meta.env.DEV ? 'http://localhost:3001' : ''

/**
 * Token ekleyen ortak API fetch wrapper'ı.
 * Tüm backend (/api/*) çağrıları bunu kullanmalı.
 * Kullanıcının Supabase access token'ını Authorization header'ına ekler,
 * böylece backend kimliği DOĞRULAYABİLİR (güvenlik — A1).
 *
 * Kullanım:
 *   const res = await apiFetch('/api/coach', { method:'POST', body: JSON.stringify({...}) })
 *
 * path: '/api/...' ile başlayan yol (BACKEND otomatik eklenir)
 */
export async function apiFetch(path, options = {}) {
  let token = null
  try {
    const { data } = await supabase.auth.getSession()
    token = data?.session?.access_token || null
  } catch {
    token = null
  }

  const headers = {
    ...(options.headers || {}),
  }
  // Body JSON ise content-type garantile
  if (options.body && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json'
  }
  // Token varsa Authorization ekle
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(`${BACKEND}${path}`, { ...options, headers })
}