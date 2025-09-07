MCP Supabase Server

Purpose
- Exposes safe tools over MCP to interact with your Supabase Postgres.
- Default tools: sql.query (restricted), rpc.call (allowlist), health.ping.

Setup
1) Node.js 18+ is required.
2) In this folder run: npm install
3) Set environment variables:
   - SUPABASE_DB_URL=postgresql://mcp_rw:PASS@db.<ref>.supabase.co:5432/postgres?sslmode=require
   - Optional hardening/relaxing:
     - MCP_TRUST_MODE=full            # allow everything (DDL + writes) — dangerous
     - MCP_ALLOW_DDL=true             # allow DDL without full trust
     - MCP_ALLOW_WRITE_ALL=true       # allow any INSERT/UPDATE/DELETE
     - MCP_RPC_ALLOWLIST=wallet_topup,wallet_charge
4) Start the server:
   npm start

Recommended DB role (run in Supabase SQL Editor)
create role mcp_rw login password 'REPLACE_WITH_STRONG_PASSWORD';
grant usage on schema public to mcp_rw;
grant select, update on table public.profiles to mcp_rw;
grant execute on function public.wallet_topup(int) to mcp_rw;
grant execute on function public.wallet_charge(int) to mcp_rw;

Tools
- sql.query
  - input: { query: string, params?: any[] }
  - blocks DDL by default, and only allows UPDATE on public.profiles unless you relax via env.
- rpc.call
  - input: { name: string, args?: Record<string, any> }
  - name must be in allowlist (default: wallet_topup, wallet_charge)
- health.ping
  - no input, returns now() to verify connectivity

MCP Client integration
- Register this server in your MCP-compatible client as a stdio provider.
- Command: node server.js (with env). The server announces tools for use.

Security notes
- Prefer a dedicated DB role with minimal privileges.
- Avoid TRUST_MODE=full in production unless you fully trust the calling agent.

