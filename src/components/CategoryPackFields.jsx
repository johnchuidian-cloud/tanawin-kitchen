import { categoryOptions, MAX_CATEGORY_LENGTH, NEW_CATEGORY } from '../lib/categories.js'
import { isMeasureUnit, singularUnit, PACK_UNITS, shortUnit } from '../lib/inventory.js'

/*
 * Both components MUST stay at module level — declared inside a screen they'd
 * be a new component type on every render, and React would rebuild the inputs
 * after each keystroke (losing the caret mid-word).
 */

export function CategoryField({ form, set, items }) {
  const options = categoryOptions(items)
  return (
    <>
      <div className="field">
        <label>Category</label>
        <select value={form.category} onChange={(e) => set('category', e.target.value)}>
          <option value="">— not sorted yet —</option>
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={NEW_CATEGORY}>＋ New category…</option>
        </select>
      </div>
      {form.category === NEW_CATEGORY ? (
        <div className="field">
          <label>New category name</label>
          <input
            value={form.newCategory}
            onChange={(e) => set('newCategory', e.target.value)}
            maxLength={MAX_CATEGORY_LENGTH}
            placeholder="e.g. Bakery, Cleaning, Baking supplies"
            autoFocus
          />
        </div>
      ) : null}
    </>
  )
}

// Only for items counted in containers (packs, bottles, pieces…). An item
// counted in kg or L already says how much one is.
export function PackSizeField({ form, set }) {
  if (isMeasureUnit(form.unit)) return null
  const one = singularUnit(form.unit)
  return (
    <div className="field">
      <label>How much is in one {one}? (optional)</label>
      <div className="pack-row">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={form.packSize}
          onChange={(e) => set('packSize', e.target.value)}
          placeholder="e.g. 250"
          aria-label={`Amount in one ${one}`}
        />
        <select value={form.packUnit} onChange={(e) => set('packUnit', e.target.value)} aria-label="Pack size unit">
          {PACK_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <div className="note" style={{ marginTop: 6 }}>
        Shows in the list as “{form.packSize > 0 ? form.packSize : '250'} {shortUnit(form.packUnit || 'g')} {one}”,
        and in the export.
      </div>
    </div>
  )
}
