const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_KEY)

export async function saveSession(payload: Record<string, unknown>): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY!,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text()
      console.warn('Supabase saveSession failed:', res.status, text)
    }
  } catch (e) {
    console.warn('Supabase saveSession error:', e)
  }
}
