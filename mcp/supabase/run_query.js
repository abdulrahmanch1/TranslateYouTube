// Usage:
// SUPABASE_DB_URL=postgresql://... node run_query.js "SQL" [JSON_PARAMS]
import pg from 'pg'

async function main() {
  const url = process.env.SUPABASE_DB_URL
  if (!url) { console.error('Missing SUPABASE_DB_URL'); process.exit(1) }
  const sqlArg = process.argv[2]
  const params = process.argv[3] ? JSON.parse(process.argv[3]) : []
  if (!sqlArg) { console.error('Usage: node run_query.js "SQL" [JSON_PARAMS]\n       or:   cat file.sql | node run_query.js -'); process.exit(1) }
  let sql = sqlArg
  if (sqlArg === '-') {
    sql = await new Promise((resolve, reject)=>{
      let data='';
      process.stdin.setEncoding('utf8')
      process.stdin.on('data', chunk=> data+=chunk)
      process.stdin.on('end', ()=> resolve(data))
      process.stdin.on('error', reject)
    })
  }
  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()
  try {
    const res = await client.query({ text: sql, values: params })
    console.log(JSON.stringify({ rowCount: res.rowCount, rows: res.rows }))
  } catch (e) {
    console.error('Error:', e?.message || e)
    process.exit(2)
  } finally {
    client.release(); await pool.end()
  }
}

main()
