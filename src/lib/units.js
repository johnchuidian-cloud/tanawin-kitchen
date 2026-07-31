// Finance records a bare number with no unit ("2" for a market purchase),
// while Kitchen stocks each item in a specific unit — grams, packs, pieces.
// Adding one to the other blindly produces nonsense (2 kg becoming 2 packs),
// so imports ask a human to confirm the amount in the kitchen's unit. These
// helpers make that confirmation quick where the maths is unambiguous.

// Only metric mass/volume converts automatically. Anything involving packs,
// pieces, cans… depends on pack size, which only a person knows.
const FACTORS = {
  kg: { g: 1000 },
  g: { kg: 0.001 },
  L: { ml: 1000 },
  ml: { L: 0.001 },
}

export function convert(value, from, to) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  if (from === to) return n
  const f = FACTORS[from]?.[to]
  return f == null ? null : Math.round(n * f * 10000) / 10000
}

/**
 * A one-tap shortcut for the common Finance mismatch: the market sells in kg
 * or litres, the kitchen counts in grams or millilitres. Returns
 * { label, value } for a button, or null when no safe conversion applies.
 */
export function convertHint(financeQty, kitchenUnit) {
  const n = Number(financeQty)
  if (!Number.isFinite(n) || n <= 0) return null
  if (kitchenUnit === 'g') return { label: 'It was kg → ×1000', value: convert(n, 'kg', 'g') }
  if (kitchenUnit === 'ml') return { label: 'It was L → ×1000', value: convert(n, 'L', 'ml') }
  if (kitchenUnit === 'kg' && n >= 1000) return { label: 'It was g → ÷1000', value: convert(n, 'g', 'kg') }
  if (kitchenUnit === 'L' && n >= 1000) return { label: 'It was ml → ÷1000', value: convert(n, 'ml', 'L') }
  return null
}

// Units where Finance's bare number almost certainly doesn't mean the same
// thing as the kitchen's count (the market sells by weight; the kitchen may
// count packs). Used to nudge the reviewer to double-check.
const AMBIGUOUS = ['packs', 'pieces', 'bottle', 'box', 'can', 'carton', 'stick', 'tub']
export const needsCheck = (kitchenUnit) => AMBIGUOUS.includes(kitchenUnit)
