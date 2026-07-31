import { useState } from 'react'
import AddStockItem from './AddStockItem.jsx'

const ADD_NEW = '__add_new__'

/**
 * Ingredient dropdown with "+ Add new item…" built in, so a missing item can
 * be created without leaving the screen. On success the new item is selected
 * automatically.
 *
 * items / value / onChange(id) — the usual select wiring
 * onItemsChanged(list)         — parent refreshes its copy of the list
 * canAdd                       — hide the add option for guests
 */
export default function IngredientSelect({ items, value, onChange, onItemsChanged, canAdd = true, label = 'Ingredient' }) {
  const [adding, setAdding] = useState(false)

  const handleChange = (e) => {
    if (e.target.value === ADD_NEW) {
      setAdding(true)
      return
    }
    onChange(e.target.value)
  }

  // Both paths (brand-new item, or an existing one matched by spelling) end
  // with that ingredient selected.
  const finish = (ingredient) => {
    const next = items.some((i) => i.id === ingredient.id)
      ? items.map((i) => (i.id === ingredient.id ? ingredient : i))
      : [...items, ingredient]
    onItemsChanged(next.sort((a, b) => a.name.localeCompare(b.name)))
    onChange(ingredient.id)
    setAdding(false)
  }

  if (adding) {
    return (
      <div className="inline-add">
        <div className="section-label" style={{ marginTop: 0 }}>New stock item</div>
        <AddStockItem
          items={items}
          onAdded={finish}
          onPicked={finish}
          onCancel={() => setAdding(false)}
        />
      </div>
    )
  }

  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={handleChange}>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
        {canAdd ? <option value={ADD_NEW}>＋ Add new item…</option> : null}
      </select>
    </div>
  )
}
