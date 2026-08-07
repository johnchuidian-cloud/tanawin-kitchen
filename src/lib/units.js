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

// ---------------------------------------------------------------------------
// COUNT SANITY CHECK
//
// This exists because it actually happened: a cook counted "500" against an
// item measured in kilos, meaning 500 grams. Half a tonne of sitsaro went in
// unremarked, and Lexi had to spot and undo it hours later.
//
// It only ever asks a question — it never blocks a save and never changes a
// number on its own. Someone may genuinely have a 100 kg sack of rice, and an
// app that cries wolf gets ignored precisely when it's right.
// ---------------------------------------------------------------------------

// Above this, a kilo/litre figure is more likely a gram/millilitre one. A B&B
// kitchen buys 25kg rice sacks, so the line is set well clear of real stock.
const BIG_FOR_HEAVY_UNIT = 100
// A jump this many times the standing figure is worth a second look whatever
// the unit — the classic slip is out by a factor of 1000.
const SUSPICIOUS_MULTIPLE = 100

/**
 * Does this counted figure look like a units mix-up?
 *
 * Returns { message, fix } — where `fix` is a one-tap correction { label,
 * value } when there's an unambiguous one — or null when it looks fine.
 */
export function countLooksOff(value, unit, currentQty) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null

  // Big number against a heavy unit: almost always grams typed into kilos.
  if ((unit === 'kg' || unit === 'L') && n >= BIG_FOR_HEAVY_UNIT) {
    const smaller = unit === 'kg' ? 'g' : 'ml'
    return {
      message: `${n.toLocaleString()} ${unit} is a lot for a kitchen. Did you mean ${n.toLocaleString()} ${smaller}?`,
      fix: { label: `Use ${convert(n, smaller, unit)} ${unit}`, value: convert(n, smaller, unit) },
    }
  }

  // The mirror image: a fraction of a gram is almost always kilos.
  if ((unit === 'g' || unit === 'ml') && n < 1) {
    const bigger = unit === 'g' ? 'kg' : 'L'
    return {
      message: `${n} ${unit} is a tiny amount. Did you mean ${n} ${bigger}?`,
      fix: { label: `Use ${convert(n, bigger, unit)} ${unit}`, value: convert(n, bigger, unit) },
    }
  }

  // No unit tell, but a wild jump from what's on record. No safe correction to
  // offer here — just a raised eyebrow.
  const current = Number(currentQty)
  if (Number.isFinite(current) && current > 0 && n / current >= SUSPICIOUS_MULTIPLE) {
    const times = Math.round(n / current)
    return {
      message: `That's about ${times.toLocaleString()}× the ${current.toLocaleString()} ${unit} on record. Worth a second look.`,
      fix: null,
    }
  }

  return null
}
