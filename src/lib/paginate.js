/**
 * PostgREST caps EVERY response at 1000 rows and says nothing about it — the
 * response comes back 200 OK with `Content-Range: 0-999/*` and no error. So a
 * read that outgrows 1000 doesn't break loudly; it quietly starts returning
 * part of the truth, which is worse.
 *
 * Verified against this project's own database: Finance's `entries` table
 * holds 1456 rows and an unbounded select returns exactly 1000 of them.
 *
 * Use this for any read whose row count grows with time or with the size of
 * the kitchen. Reads bounded by something small and fixed (settings, staff,
 * suppliers) don't need it.
 *
 * `build` must return a FRESH query builder each call — a Supabase builder is
 * single-use and can't be re-ranged.
 *
 *   const rows = await fetchAllRows(() =>
 *     supabase.from('stock_movements').select('id').eq('kind', 'count'))
 */
const PAGE = 1000

export async function fetchAllRows(build, { pageSize = PAGE, maxPages = 50 } = {}) {
  const out = []
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize
    const { data, error } = await build().range(from, from + pageSize - 1)
    if (error) throw error
    const rows = data ?? []
    out.push(...rows)
    // A short page means we've reached the end.
    if (rows.length < pageSize) return out
  }
  // Only reachable at 50,000+ rows in one read, which would be a design
  // problem rather than a paging problem — say so instead of looping forever.
  console.warn('fetchAllRows stopped at the page cap; the query needs narrowing.')
  return out
}
