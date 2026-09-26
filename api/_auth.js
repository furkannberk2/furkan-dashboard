// api/_auth.js
// Ortak kimlik doğrulama helper'ı.
// AŞAMA 1 (şu an): Token varsa doğrular ve GERÇEK user_id'yi döndürür.
//   Token yoksa null döndürür — çağıran taraf eski davranışa (parametre user_id) düşebilir.
//   Bu sayede mevcut çalışma BOZULMAZ (geriye dönük uyumlu).
// AŞAMA 2 (frontend token gönderdikten SONRA): requireAuth ile token ZORUNLU yapılır.

import { createClient } from '@supabase/supabase-js'

// Token doğrulamak için ANON key'li ayrı bir client (service_role DEĞİL)
const authClient = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

/**
 * İstekteki Authorization: Bearer <token> header'ından kullanıcıyı doğrular.
 * @returns {Promise<string|null>} doğrulanmış user_id, ya da token yok/geçersizse null
 */
export async function getUserIdFromToken(req) {
  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return null

    const { data, error } = await authClient.auth.getUser(token)
    if (error || !data?.user) return null
    return data.user.id
  } catch {
    return null
  }
}

/**
 * AŞAMA 1 — Geriye dönük uyumlu kullanıcı çözümü.
 * Önce token'dan gerçek user_id'yi almaya çalışır (güvenli).
 * Token yoksa, fallback olarak parametredeki user_id'yi kullanır (eski davranış).
 * @param {object} req
 * @param {string|null} paramUserId  body/query'den gelen user_id (fallback)
 * @returns {Promise<string|null>}
 */
export async function resolveUserId(req, paramUserId) {
  const tokenUserId = await getUserIdFromToken(req)
  if (tokenUserId) return tokenUserId          // güvenli yol: token doğrulandı
  return paramUserId || null                    // fallback: eski davranış (geçici)
}