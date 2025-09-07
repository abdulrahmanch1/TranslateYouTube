// One-off helper: ensure a profile row exists for a given user id
// Usage: SUPABASE_DB_URL=postgresql://... node ensure_profile_for.js <user_uuid>

import pg from 'pg'

async function main() {
  const uid = process.argv[2]
  if (!uid) {
    console.error('Usage: node ensure_profile_for.js <user_uuid>')
    process.exit(1)
  }
  const url = process.env.SUPABASE_DB_URL
  if (!url) {
    console.error('Missing SUPABASE_DB_URL env')
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()
  try {
    // Try RPC first
    try {
      await client.query('select public.ensure_profile_for($1)', [uid])
    } catch (_) {
      // Fallback: direct insert if function not present
      await client.query(
        'insert into public.profiles (id) values ($1) on conflict (id) do nothing',
        [uid]
      )
    }
    const res = await client.query('select id, balance_cents from public.profiles where id = $1', [uid])
    console.log(JSON.stringify({ ok: true, row: res.rows[0] || null }))
  } catch (e) {
    console.error('Error:', e?.message || e)
    process.exit(2)
  } finally {
    client.release()
    await pool.end()
  }
}

main()

