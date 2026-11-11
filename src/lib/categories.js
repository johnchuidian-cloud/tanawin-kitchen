// ---------------------------------------------------------------------------
// FOOD CATEGORIES — how the Inventory list is grouped ("Proteins", "Dry Goods").
//
// Stored on each item as plain text (ingredients.category, migration 14). A
// custom category is simply a new name typed into an item's form: it exists
// for as long as at least one item uses it, and there is no separate table to
// keep in sync. An empty custom group has nothing to show, so it has no reason
// to linger in the list.
//
// Separate from the meal tag (Breakfast / Lunch-Dinner), which says WHEN an
// item is used rather than WHAT it is.
// ---------------------------------------------------------------------------

export const BASE_CATEGORIES = [
  { name: 'Proteins', icon: '🥩' },
  { name: 'Produce', icon: '🥬' },
  { name: 'Dairy & Eggs', icon: '🥚' },
  { name: 'Dry Goods', icon: '🌾' },
  { name: 'Condiments & Sauces', icon: '🧂' },
  { name: 'Beverages', icon: '☕' },
  { name: 'Frozen', icon: '🧊' },
  { name: 'Other', icon: '📦' },
]

// Items that haven't been given a category yet. Grouped last, so they're easy
// to find and sort.
export const UNSORTED = 'Not sorted yet'

const CUSTOM_ICON = '🏷️'
const UNSORTED_ICON = '❔'

const baseIndex = new Map(BASE_CATEGORIES.map((c, i) => [c.name.toLowerCase(), i]))
const isBase = (name) => baseIndex.has((name ?? '').toLowerCase())

export const groupName = (item) => (item.category ?? '').trim() || UNSORTED

export function categoryIcon(name) {
  if (!name || name === UNSORTED) return UNSORTED_ICON
  const i = baseIndex.get(name.toLowerCase())
  return i == null ? CUSTOM_ICON : BASE_CATEGORIES[i].icon
}

// What the jump bar shows for a group: the base categories' emoji, a custom
// one's first letter (several custom groups would all share one emoji), and a
// question mark for the unsorted pile.
export function railLabel(name) {
  if (name === UNSORTED) return UNSORTED_ICON
  return isBase(name) ? categoryIcon(name) : name.trim()[0].toUpperCase()
}

/**
 * Sort key for a group heading. Order:
 *   the base categories as listed above (except Other)
 *   → custom categories, A–Z
 *   → Other
 *   → Not sorted yet
 * "Other" and the unsorted pile sit at the end because they're the leftovers.
 */
export function categorySortKey(name) {
  if (!name || name === UNSORTED) return '3'
  const i = baseIndex.get(name.toLowerCase())
  if (i == null) return `1${name.toLowerCase()}`
  if (BASE_CATEGORIES[i].name === 'Other') return '2'
  return `0${String(i).padStart(2, '0')}`
}

// Every category the picker offers: the base set, then any custom ones already
// in use (A–Z), so a new item can join an existing custom group.
export function categoryOptions(items) {
  const custom = new Set()
  for (const i of items ?? []) {
    const c = (i.category ?? '').trim()
    if (c && !isBase(c)) custom.add(c)
  }
  return [...BASE_CATEGORIES.map((c) => c.name), ...[...custom].sort((a, b) => a.localeCompare(b))]
}

// What a typed category name is stored as. Reuses an existing spelling when
// it's the same name in a different case, so typing "proteins" joins Proteins
// instead of starting a second group beside it.
export function resolveCategory(input, items) {
  const clean = (input ?? '').trim().replace(/\s+/g, ' ')
  if (!clean) return null
  return categoryOptions(items).find((c) => c.toLowerCase() === clean.toLowerCase()) ?? clean
}

export const MAX_CATEGORY_LENGTH = 30

// The picker value meaning "I'm typing a new category".
export const NEW_CATEGORY = '__new__'

/**
 * What an item form's category fields should store, or why they can't be
 * saved. Returns { category } or { error }.
 */
export function resolveFormCategory(form, items) {
  if (form.category !== NEW_CATEGORY) return { category: form.category || null }
  const typed = (form.newCategory ?? '').trim()
  if (!typed) return { error: 'Type a name for the new category, or pick one from the list.' }
  if (typed.length > MAX_CATEGORY_LENGTH)
    return { error: `Keep the category name under ${MAX_CATEGORY_LENGTH} characters.` }
  return { category: resolveCategory(typed, items) }
}
