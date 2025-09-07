// MCP Server for Supabase Postgres access via limited tools
// Tools:
// - sql.query: run parameterized SELECT/UPDATE restricted by policy (unless TRUST_MODE=full)
// - rpc.call: call allowed functions (wallet_topup, wallet_charge by default)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import pg from 'pg'

const { Pool } = pg

const NAME = 'mcp-supabase'
const VERSION = process.env.MCP_VERSION || '0.1.0'

const DB_URL = process.env.SUPABASE_DB_URL
if (!DB_URL) {
  console.error('Missing SUPABASE_DB_URL environment variable')
  process.exit(1)
}

const TRUST_MODE = (process.env.MCP_TRUST_MODE || '').toLowerCase() === 'full'
const ALLOW_DDL = TRUST_MODE || (process.env.MCP_ALLOW_DDL === 'true')
const ALLOW_WRITE_ALL = TRUST_MODE || (process.env.MCP_ALLOW_WRITE_ALL === 'true')
const ALLOW_RPC = (process.env.MCP_RPC_ALLOWLIST || 'wallet_topup,wallet_charge,ensure_profile_for')
  .split(',').map(s=>s.trim()).filter(Boolean)

const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

function isDangerous(sql) {
  const s = sql.trim().toLowerCase()
  if (!ALLOW_DDL && /(\bdrop\b|\balter\b|\bcreate\b|\bgrant\b|\brevoke\b|\btruncate\b|\bvaccum\b)/.test(s)) return true
  return false
}

function isWrite(sql) {
  const s = sql.trim().toLowerCase()
  return /^(insert|update|delete|merge|call|do)\b/.test(s)
}

function writesAllowed(sql) {
  if (ALLOW_WRITE_ALL) return true
  // allow update only on public.profiles when not full trust
  const s = sql.trim().toLowerCase()
  if (/^update\s+public\.profiles\b/.test(s)) return true
  if (/^insert\s+into\s+public\.profiles\b/.test(s)) return false
  if (/^delete\s+from\s+/.test(s)) return false
  return !isWrite(s)
}

const mcp = new McpServer(
  { name: NAME, version: VERSION },
  { capabilities: { tools: {} } }
)

// sql.query tool
mcp.tool('sql.query', {
  query: z.string(),
  params: z.array(z.any()).optional(),
}, async ({ query, params }) => {
  if (isDangerous(query)) {
    return { content: [{ type: 'text', text: 'Blocked: DDL disabled' }], isError: true }
  }
  if (!writesAllowed(query)) {
    return { content: [{ type: 'text', text: 'Blocked: write not allowed' }], isError: true }
  }
  const client = await pool.connect()
  try {
    const res = await client.query({ text: query, values: params || [] })
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, rowCount: res.rowCount, rows: res.rows }) }] }
  } catch (e) {
    return { content: [{ type: 'text', text: String(e?.message || e) }], isError: true }
  } finally {
    client.release()
  }
})

// rpc.call tool
mcp.tool('rpc.call', {
  name: z.string(),
  args: z.record(z.any()).optional(),
}, async ({ name, args }) => {
  if (!TRUST_MODE && !ALLOW_RPC.includes(name)) {
    return { content: [{ type: 'text', text: `RPC not allowed: ${name}` }], isError: true }
  }
  const keys = Object.keys(args || {})
  const placeholders = keys.map((_, i) => `$${i+1}`).join(', ')
  const values = keys.map(k => args?.[k])
  const sql = `select public.${name}(${placeholders}) as result`
  const client = await pool.connect()
  try {
    const res = await client.query({ text: sql, values })
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, result: res.rows?.[0]?.result ?? null }) }] }
  } catch (e) {
    return { content: [{ type: 'text', text: String(e?.message || e) }], isError: true }
  } finally { client.release() }
})

// health.ping tool
mcp.tool('health.ping', async () => {
  const client = await pool.connect()
  try {
    const res = await client.query('select now() as now')
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, now: res.rows[0]?.now }) }] }
  } catch (e) {
    return { content: [{ type: 'text', text: String(e?.message || e) }], isError: true }
  } finally { client.release() }
})

const transport = new StdioServerTransport()
mcp.connect(transport).catch((err) => {
  console.error('MCP server failed:', err)
  process.exit(1)
})
