import { useSyncExternalStore } from 'react'
import { supabase } from './supabase.js'
import { setSetting } from './settings.js'
import { logActivity } from './activity.js'

// ---------------------------------------------------------------------------
// FOOD CATEGORIES — how the Inventory list is grouped ("Proteins", "Dry Goods").
//
// Two pieces:
//   * each item's category, as plain text on ingredients.category (migration 14);
//   * the CATEGORY LIST — names, icons and their order — kept in the shared
//     kitchen_settings table under 'categories', so the owner can add, rename,
//     reorder and remove categories on the Categories screen without a
//     database change. Until someone saves a list, DEFAULT_CATEGORIES applies.
//
// A name typed with "＋ New category…" in an item's form works before it's on
// the list: it shows up as an extra group just above Other, and the Categories
// screen lists it so it can be given an icon or moved.
// ---------------------------------------------------------------------------

export const DEFAULT_CATEGORIES = [
  { name: 'Proteins', icon: '🥩' },
  { name: 'Produce', icon: '🥬' },
  { name: 'Dairy & Eggs', icon: '🥚' },
  { name: 'Dry Goods', icon: '🌾' },
  { name: 'Condiments & Sauces', icon: '🧂' },
  { name: 'Beverages', icon: '☕' },
  { name: 'Other', icon: '📦' },
]

export const SETTING_CATEGORIES = 'categories'

// Items that haven't been given a category yet. Grouped last, so they're easy
// to find and sort.
export const UNSORTED = 'Not sorted yet'

export const CUSTOM_ICON = '🏷️'
const UNSORTED_ICON = '❔'

// The icons the Categories screen offers. A fixed set rather than free text:
// it's tapped on a phone, and every one of these renders on older Androids.
export const CATEGORY_ICONS = [
  '🥩', '🍗', '🐟', '🦐', '🥬', '🥕', '🍅', '🧅', '🍎', '🍌',
  '🥚', '🧀', '🥛', '🧈', '🌾', '🍚', '🍞', '🥫', '🧂', '🌶️',
  '☕', '🧃', '🍺', '🧊', '🍰', '🍯', '🧴', '🧽', '📦', CUSTOM_ICON,
]

export const MAX_CATEGORY_LENGTH = 30
const MAX_CATEGORIES = 50

const clean = (name) => (typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '')
const same = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase()

/**
 * A stored list made safe to use: whatever is in the settings row (it's
 * shared, and editable outside the app) comes back as [{ name, icon }] with
 * sensible names, no duplicates and a known icon. Anything unusable falls
 * back to the default list.
 */
export function sanitizeCategoryList(raw) {
  if (!Array.isArray(raw)) return null
  const out = []
  for (const c of raw) {
    const name = clean(c?.name)
    if (!name || name.length > MAX_CATEGORY_LENGTH || name === UNSORTED) continue
    if (out.some((o) => same(o.name, name))) continue
    out.push({ name, icon: CATEGORY_ICONS.includes(c?.icon) ? c.icon : CUSTOM_ICON })
    if (out.length >= MAX_CATEGORIES) break
  }
  return out
}

// ---- the shared list, loaded once per session ----

let stored = null // null until loaded (or when nothing has been saved yet)
let loading = null
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())

export const getCategoryList = () => stored ?? DEFAULT_CATEGORIES

function setList(list) {
  stored = list
  emit()
}

/**
 * Read the saved list. Non-fatal: if the read fails, the defaults stay in
 * place and the Inventory still groups sensibly. `fresh` re-reads even when
 * already loaded (the Categories screen does, in case someone else changed it).
 */
export function loadCategories({ fresh = false } = {}) {
  if (loading && !fresh) return loading
  loading = supabase
    .from('kitchen_settings')
    .select('value')
    .eq('key', SETTING_CATEGORIES)
    .limit(1)
    .then(({ data, error }) => {
      if (error) {
        console.warn('Category list read failed (using defaults):', error.message)
        return
      }
      const list = sanitizeCategoryList(data?.[0]?.value)
      if (list) setList(list)
    })
  return loading
}

// For screens that group by category: re-renders when the list arrives or
// changes, and starts the one-time load.
export function useCategoryList() {
  if (!loading) loadCategories()
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    getCategoryList
  )
}

// ---- grouping and ordering ----

export const groupName = (item) => clean(item.category) || UNSORTED

const listIndex = (name) => getCategoryList().findIndex((c) => same(c.name, name))

export function categoryIcon(name) {
  if (!name || name === UNSORTED) return UNSORTED_ICON
  const i = listIndex(name)
  return i < 0 ? CUSTOM_ICON : getCategoryList()[i].icon
}

// What the jump bar shows for a group: its icon, or the first letter when it
// only has the generic tag (several of those would look identical), and a
// question mark for the unsorted pile.
export function railLabel(name) {
  if (name === UNSORTED) return UNSORTED_ICON
  const icon = categoryIcon(name)
  return icon === CUSTOM_ICON ? clean(name)[0].toUpperCase() : icon
}

/**
 * Sort key for a group heading. Order:
 *   the category list, in the order the owner set
 *   → names not on the list yet (A–Z), placed just above "Other" if the
 *     list has one, otherwise after the list
 *   → Not sorted yet
 */
export function categorySortKey(name) {
  if (!name || name === UNSORTED) return '9999'
  const list = getCategoryList()
  const i = listIndex(name)
  if (i >= 0) return String(i * 2 + 1).padStart(4, '0')
  const other = list.findIndex((c) => same(c.name, 'Other'))
  const slot = other < 0 ? list.length : other
  return `${String(slot * 2).padStart(4, '0')}${clean(name).toLowerCase()}`
}

/**
 * Every category with its icon, in display order: the saved list plus any
 * name items use that isn't on it yet. What the Categories screen lists and
 * what gets saved when the owner changes anything there, so those extra names
 * join the list the first time they're touched.
 */
export function effectiveCategories(items) {
  const list = getCategoryList().map((c) => ({ ...c, listed: true }))
  for (const i of items ?? []) {
    const c = clean(i.category)
    if (c && !list.some((l) => same(l.name, c))) list.push({ name: c, icon: CUSTOM_ICON, listed: false })
  }
  return list.sort((a, b) => categorySortKey(a.name).localeCompare(categorySortKey(b.name)))
}

// Every category the item picker offers, in display order.
export const categoryOptions = (items) => effectiveCategories(items).map((c) => c.name)

// What a typed category name is stored as. Reuses an existing spelling when
// it's the same name in a different case, so typing "proteins" joins Proteins
// instead of starting a second group beside it.
export function resolveCategory(input, items) {
  const name = clean(input)
  if (!name) return null
  return categoryOptions(items).find((c) => same(c, name)) ?? name
}

// The picker value meaning "I'm typing a new category".
export const NEW_CATEGORY = '__new__'

/**
 * Why a typed category name can't be used, or null when it's fine. Shared by
 * the item form and the Categories screen.
 */
export function categoryNameError(input) {
  const name = clean(input)
  if (!name) return 'Type a name for the category.'
  if (name.length > MAX_CATEGORY_LENGTH) return `Keep the category name under ${MAX_CATEGORY_LENGTH} characters.`
  if (same(name, UNSORTED)) return `“${UNSORTED}” is reserved for items without a category.`
  return null
}

/**
 * What an item form's category fields should store, or why they can't be
 * saved. Returns { category } or { error }.
 */
export function resolveFormCategory(form, items) {
  if (form.category !== NEW_CATEGORY) return { category: form.category || null }
  if (!clean(form.newCategory)) return { error: 'Type a name for the new category, or pick one from the list.' }
  const err = categoryNameError(form.newCategory)
  if (err) return { error: err }
  return { category: resolveCategory(form.newCategory, items) }
}

// ---- changing the list (Categories screen) ----

const toStored = (list) => list.map(({ name, icon }) => ({ name, icon }))

/** Save a new order / icon / added category. */
export async function saveCategoryList(list, actorId, what) {
  const next = sanitizeCategoryList(toStored(list))
  await setSetting(SETTING_CATEGORIES, next)
  setList(next)
  if (what) await logActivity(`Categories — ${what}`, actorId, { type: 'categories' })
}

// Move every item (archived ones too) from one category name to another; null
// means "Not sorted yet". Returns how many moved.
async function moveAllItems(from, to) {
  const { data, error } = await supabase
    .from('ingredients')
    .update({ category: to })
    .eq('category', from)
    .select('id')
  if (error) throw error
  return (data ?? []).length
}

const items_ = (n) => `${n} item${n === 1 ? '' : 's'}`

/**
 * Rename a category, carrying its items along. Renaming onto a name that
 * already exists merges the two (the screen asks first).
 */
export async function renameCategory(list, oldName, newName, actorId) {
  const target = list.find((c) => !same(c.name, oldName) && same(c.name, newName))
  const finalName = target ? target.name : clean(newName)
  const moved = await moveAllItems(oldName, finalName)
  const next = target
    ? list.filter((c) => !same(c.name, oldName))
    : list.map((c) => (same(c.name, oldName) ? { ...c, name: finalName } : c))
  await saveCategoryList(
    next,
    actorId,
    target
      ? `${oldName} merged into ${finalName} (${items_(moved)})`
      : `${oldName} renamed to ${finalName} (${items_(moved)})`
  )
  return moved
}

/** Take a category off the list, moving its items to `moveTo` (null = Not sorted yet). */
export async function removeCategory(list, name, moveTo, actorId) {
  const moved = await moveAllItems(name, moveTo)
  await saveCategoryList(
    list.filter((c) => !same(c.name, name)),
    actorId,
    `${name} removed${moved ? ` (${items_(moved)} moved to ${moveTo ?? UNSORTED})` : ''}`
  )
  return moved
}
