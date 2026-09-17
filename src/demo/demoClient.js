// ---------------------------------------------------------------------------
// DEMO SUPABASE CLIENT — an in-memory stand-in, never a network call.
//
// Implements just enough of the PostgREST query-builder chain that Kitchen
// actually uses (see the audit in the commit message) to serve the fixtures.
// Loaded only under VITE_DEMO=1. Its whole purpose is that the portfolio
// screenshot build reaches NO real database — Kitchen's is Finance's live one.
//
// The fixtures pre-embed their joined objects (supplier, lines, actor, …), so
// the mock ignores the select() column string entirely except to detect a
// head/count request.
// ---------------------------------------------------------------------------

import { fixtures } from './fixtures.js'

const OPS = {
  eq: (v, t) => v === t,
  neq: (v, t) => v !== t,
  in: (v, t) => Array.isArray(t) && t.includes(v),
  is: (v, t) => (t === null ? v === null || v === undefined : v === t),
  gte: (v, t) => v >= t,
  lte: (v, t) => v <= t,
  gt: (v, t) => v > t,
  lt: (v, t) => v < t,
}

function applyFilters(rows, filters) {
  return rows.filter((r) => filters.every((f) => OPS[f.op](r[f.col], f.val)))
}

class Builder {
  constructor(table) {
    this.table = table
    this.filters = []
    this.orders = []
    this._range = null
    this._limit = null
    this._single = false
    this._count = false
    this._head = false
    this._op = 'select'
    this._payload = null
  }

  select(_cols, opts) {
    if (opts?.count) this._count = true
    if (opts?.head) this._head = true
    return this
  }
  insert(p) { this._op = 'insert'; this._payload = Array.isArray(p) ? p : [p]; return this }
  update(p) { this._op = 'update'; this._payload = p; return this }
  upsert(p) { this._op = 'upsert'; this._payload = Array.isArray(p) ? p : [p]; return this }
  delete() { this._op = 'delete'; return this }

  eq(c, v) { this.filters.push({ col: c, op: 'eq', val: v }); return this }
  neq(c, v) { this.filters.push({ col: c, op: 'neq', val: v }); return this }
  in(c, v) { this.filters.push({ col: c, op: 'in', val: v }); return this }
  is(c, v) { this.filters.push({ col: c, op: 'is', val: v }); return this }
  gte(c, v) { this.filters.push({ col: c, op: 'gte', val: v }); return this }
  lte(c, v) { this.filters.push({ col: c, op: 'lte', val: v }); return this }
  gt(c, v) { this.filters.push({ col: c, op: 'gt', val: v }); return this }
  lt(c, v) { this.filters.push({ col: c, op: 'lt', val: v }); return this }
  order(c, opts) { this.orders.push({ col: c, asc: !(opts && opts.ascending === false) }); return this }
  range(a, b) { this._range = [a, b]; return this }
  limit(n) { this._limit = n; return this }
  single() { this._single = true; return this._run() }
  maybeSingle() { this._single = true; return this._run() }
  then(onF, onR) { return this._run().then(onF, onR) }

  _store() {
    fixtures[this.table] ||= []
    return fixtures[this.table]
  }

  _run() {
    try {
      const store = this._store()

      if (this._op === 'select') {
        let rows = applyFilters(store.slice(), this.filters)
        for (const o of [...this.orders].reverse()) {
          rows.sort((a, b) => (a[o.col] > b[o.col] ? 1 : a[o.col] < b[o.col] ? -1 : 0))
          if (!o.asc) rows.reverse()
        }
        const total = rows.length
        if (this._head) return ok({ data: [], count: total })
        if (this._range) rows = rows.slice(this._range[0], this._range[1] + 1)
        if (this._limit != null) rows = rows.slice(0, this._limit)
        if (this._single) {
          return rows[0]
            ? ok({ data: rows[0], count: this._count ? total : undefined })
            : ok({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
        }
        return ok({ data: rows, count: this._count ? total : undefined })
      }

      if (this._op === 'insert' || this._op === 'upsert') {
        const rows = this._payload.map((r, i) => ({
          id: r.id ?? `demo-${this.table}-${store.length + i}`,
          ...r,
        }))
        store.push(...rows)
        return ok({ data: this._single ? rows[0] : rows })
      }

      if (this._op === 'update') {
        const matched = applyFilters(store, this.filters)
        matched.forEach((r) => Object.assign(r, this._payload))
        return ok({ data: this._single ? matched[0] ?? null : matched })
      }

      if (this._op === 'delete') {
        const removed = applyFilters(store, this.filters)
        fixtures[this.table] = store.filter((r) => !removed.includes(r))
        return ok({ data: removed })
      }

      return ok({ data: null })
    } catch (e) {
      return ok({ data: null, error: { message: String(e) } })
    }
  }
}

const ok = ({ data, count, error }) => Promise.resolve({ data, count, error: error ?? null })

export function makeDemoClient() {
  // eslint-disable-next-line no-console
  console.warn('⚠️ Tanawin Kitchen running in DEMO mode — fictional data, no database.')
  return { from: (table) => new Builder(table) }
}
