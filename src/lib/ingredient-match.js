// Keeps the stock list from sprouting duplicates when people type the same
// item different ways — "sibuyas" / "Onions" / "onion" should all land on the
// one Onion row. Mirrors the vendor-alias idea used in Tanawin Finance.

export const normalize = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]/g, '')

// Tagalog (and common local) names → the English name the kitchen standardises
// on. Culturally specific items (pandesal, alamang, tinapa, tuyo, patis…) are
// deliberately absent: they have no clearer English name, so they stay as-is.
export const TAGALOG_EN = {
  sibuyas: 'onion',
  bawang: 'garlic',
  luya: 'ginger',
  kamatis: 'tomato',
  repolyo: 'cabbage',
  talong: 'eggplant',
  okra: 'okra',
  kangkong: 'water spinach',
  petchay: 'bok choy',
  pechay: 'bok choy',
  sitaw: 'string beans',
  patatas: 'potato',
  karot: 'carrot',
  kalabasa: 'squash',
  mais: 'corn',
  saging: 'banana',
  kalamansi: 'calamansi',
  sampaloc: 'tamarind',
  manok: 'chicken',
  baboy: 'pork',
  baka: 'beef',
  isda: 'fish',
  hipon: 'shrimp',
  pusit: 'squid',
  alimasag: 'crab',
  tahong: 'mussels',
  itlog: 'egg',
  bigas: 'rice',
  kanin: 'rice',
  asin: 'salt',
  paminta: 'pepper',
  asukal: 'sugar',
  mantika: 'cooking oil',
  langis: 'cooking oil',
  suka: 'vinegar',
  toyo: 'soy sauce',
  gatas: 'milk',
  keso: 'cheese',
  mantikilya: 'butter',
  harina: 'flour',
  sili: 'chili',
  gulay: 'vegetables',
  prutas: 'fruit',
}

// Rough singular, so "carrots" and "carot" (a typo of "carrot") can meet in
// the middle instead of looking two edits apart.
const singular = (s) => (s.length > 3 && s.endsWith('s') ? s.slice(0, -1) : s)

// Very small edit-distance check — catches typos and plural/singular slips
// ("onions" vs "onion", "carot" vs "carrot") without pulling in a library.
function closeEnough(a, b) {
  if (a === b) return true
  if (singular(a) !== a || singular(b) !== b) {
    const sa = singular(a)
    const sb = singular(b)
    if (sa !== a || sb !== b) {
      if (sa === sb) return true
      if (oneEdit(sa, sb)) return true
    }
  }
  return oneEdit(a, b)
}

function oneEdit(a, b) {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 2) return false
  if (a.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true
  let edits = 0
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

// Every spelling that should resolve to a given ingredient.
const keysFor = (ing) => [ing.name, ...(ing.aliases ?? [])].map(normalize).filter(Boolean)

/**
 * Does `typed` already exist in the list, under any name?
 * Returns { match, reason } — reason explains it in plain language for the UI,
 * or null when the name looks genuinely new.
 */
export function findExisting(typed, items) {
  const n = normalize(typed)
  if (!n) return null

  // 1. Exact hit on the name or a saved alias.
  for (const ing of items) {
    if (keysFor(ing).includes(n)) {
      return {
        match: ing,
        reason: normalize(ing.name) === n ? 'already in the list' : `already in the list as "${ing.name}"`,
      }
    }
  }

  // 2. Known Tagalog name → look for its English counterpart.
  const english = TAGALOG_EN[n]
  if (english) {
    const en = normalize(english)
    const hit = items.find((ing) => keysFor(ing).some((k) => k === en || closeEnough(k, en)))
    if (hit) return { match: hit, reason: `the Tagalog name for "${hit.name}"` }
  }

  // 3. Typo / plural of something that exists.
  for (const ing of items) {
    if (keysFor(ing).some((k) => closeEnough(k, n))) {
      return { match: ing, reason: `looks like "${ing.name}"` }
    }
  }

  return null
}

// Suggested standard name when someone types a Tagalog one and it ISN'T in the
// list yet — e.g. "sibuyas" → "Onion". Null when we have no opinion.
export function englishSuggestion(typed) {
  const en = TAGALOG_EN[normalize(typed)]
  if (!en) return null
  const titled = en.replace(/\b\w/g, (c) => c.toUpperCase())
  return normalize(titled) === normalize(typed) ? null : titled
}
