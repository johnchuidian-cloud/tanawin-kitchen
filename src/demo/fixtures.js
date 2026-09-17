// ---------------------------------------------------------------------------
// DEMO FIXTURES — entirely fictional data for portfolio screenshots.
//
// Nothing here is real. Invented staff, invented suppliers, invented prices.
// Kitchen shares Finance's LIVE database, so screenshots must NEVER be taken
// against it — this fixture set is the only data the demo build ever sees.
//
// Only loaded when the app is built with VITE_DEMO=1 (see lib/supabase.js),
// which is never committed to any deploy environment.
// ---------------------------------------------------------------------------

const now = Date.now()
const DAY = 86400000
const daysAgo = (n) => new Date(now - n * DAY).toISOString()
const dayKey = (n) => new Date(now - n * DAY).toISOString().slice(0, 10)

export const fixtures = {
  kitchen_users: [
    { id: 'usr-admin', name: 'Nena Reyes', role: 'admin', pin: 'x'.repeat(64), created_at: daysAgo(60) },
    { id: 'usr-ben', name: 'Ben Santos', role: 'staff', pin: 'x'.repeat(64), created_at: daysAgo(55) },
    { id: 'usr-rosa', name: 'Rosa Aquino', role: 'staff', pin: 'x'.repeat(64), created_at: daysAgo(40) },
    { id: 'usr-mika', name: 'Mika del Rosario', role: 'staff', pin: 'x'.repeat(64), created_at: daysAgo(20) },
    { id: 'usr-guest', name: 'Guest', role: 'guest', pin: 'x'.repeat(64), created_at: daysAgo(60) },
  ],

  suppliers: [
    { id: 'sup-market', name: 'Bayan Public Market', category: 'Produce, seafood, poultry', location: 'Poblacion', contact: '0917 555 0110' },
    { id: 'sup-grocery', name: 'MetroFresh Grocery', category: 'Oils, sauces, dry goods', location: 'National Rd', contact: '0917 555 0142' },
    { id: 'sup-dairy', name: 'Sunrise Dairy', category: 'Milk, butter, eggs', location: 'Del Pilar', contact: '0918 555 0088' },
    { id: 'sup-grains', name: 'Golden Grains Trading', category: 'Rice, flour, sugar', location: 'Market Ave', contact: '0920 555 0033' },
  ],

  // supplier + optional columns embedded, so the mock can return rows as-is.
  ingredients: [
    ing('ing-chicken', 'Chicken', 'kg', 8, 5, 185, 'sup-market', 'lunch_dinner', 3, null),
    ing('ing-porkbelly', 'Pork belly', 'kg', 6, 4, 260, 'sup-market', 'lunch_dinner', 3, null),
    ing('ing-bangus', 'Bangus (milkfish)', 'kg', 4, 3, 170, 'sup-market', 'lunch_dinner', 4, null),
    ing('ing-rice', 'Rice', 'kg', 40, 10, 52, 'sup-grains', 'both', 30, null),
    ing('ing-egg', 'Eggs', 'pieces', 90, 60, 8.5, 'sup-dairy', 'breakfast', 14, '1 tray = 30 pcs'),
    ing('ing-oil', 'Cooking oil', 'L', 5, 3, 92, 'sup-grocery', 'both', 120, null),
    ing('ing-garlic', 'Garlic', 'g', 800, 500, 0.28, 'sup-market', 'both', 30, null),
    ing('ing-onion', 'Onion', 'kg', 0.4, 1, 95, 'sup-market', 'both', 21, null),
    ing('ing-tomato', 'Tomato', 'kg', 2, 1, 70, 'sup-market', 'both', 7, null),
    ing('ing-soy', 'Soy sauce', 'bottle', 6, 3, 48, 'sup-grocery', 'both', 365, '1 bottle = 1 L'),
    ing('ing-vinegar', 'Vinegar', 'bottle', 5, 3, 38, 'sup-grocery', 'both', 365, null),
    ing('ing-milk', 'Fresh milk', 'L', 0.5, 2, 105, 'sup-dairy', 'breakfast', 5, null),
    ing('ing-butter', 'Butter', 'g', 250, 200, 0.9, 'sup-dairy', 'breakfast', 60, '1 pack = 225 g'),
    ing('ing-flour', 'All-purpose flour', 'kg', 3, 2, 58, 'sup-grains', 'breakfast', 180, null),
    ing('ing-sugar', 'Sugar', 'kg', 5, 2, 70, 'sup-grains', 'both', 365, null),
    ing('ing-coffee', 'Coffee beans', 'g', 300, 400, 1.4, 'sup-grocery', 'breakfast', 90, null),
    // one archived item, to exercise the archived filter/view
    { id: 'ing-old', name: 'Assorted vegetables', unit: 'kg', quantity: 0, min_threshold: 0, cost_per_unit: 0, meal_tag: null, aliases: [], supplier_id: null, supplier: null, shelf_life_days: null, notes: null, archived_at: daysAgo(10) },
  ],

  recipes: [
    recipe('rec-adobo', 'Chicken Adobo', 'Mains', 4, true, 'lunch_dinner',
      [{ label: 'for 2', price: 220, cost: 96.5 }, { label: 'for 4', price: 400, cost: 188 }],
      [
        cline('Chicken', 'kg', [0.5, 1], [92.5, 185]),
        cline('Soy sauce', 'ml', [60, 120], [2.9, 5.8]),
        cline('Vinegar', 'ml', [45, 90], [1.7, 3.4]),
        cline('Garlic', 'g', [30, 60], [8.4, 16.8]),
        cline('Onion', 'kg', [0.05, 0.1], [4.8, 9.5]),
        cline('Gas', '', [null, null], [3, 5]),
      ],
      [
        rline('ing-chicken', 'Chicken', 'kg', 1, 185),
        rline('ing-garlic', 'Garlic', 'g', 60, 0.28),
        rline('ing-onion', 'Onion', 'kg', 0.1, 95),
        rline('ing-soy', 'Soy sauce', 'ml', 120, 0.048),
      ]),
    recipe('rec-sinigang', 'Pork Sinigang', 'Mains', 4, true, 'lunch_dinner',
      [{ label: 'for 4', price: 420, cost: 205 }], [], []),
    recipe('rec-bulalo', 'Beef Bulalo', 'Mains', 6, true, 'lunch_dinner',
      [{ label: 'for 6', price: 780, cost: 430 }], [], []),
    recipe('rec-garlicrice', 'Garlic Fried Rice', 'Sides', 2, true, 'both',
      [{ label: 'each', price: 65, cost: 18 }], [], []),
    recipe('rec-pancakes', 'Buttermilk Pancakes', 'Breakfast', 3, true, 'breakfast',
      [{ label: 'plate of 3', price: 150, cost: 46 }], [], []),
    recipe('rec-tapsilog', 'Beef Tapsilog', 'Breakfast', 1, true, 'breakfast',
      [{ label: 'each', price: 180, cost: 74 }], [], []),
    recipe('rec-halohalo', 'Halo-Halo', 'Desserts', 1, false, 'both',
      [{ label: 'each', price: 120, cost: null }], [], []),
  ],

  approvals: [
    {
      id: 'apr-1', change_type: 'recipe_costing', status: 'pending',
      summary: 'Edit costing — Pork Sinigang: Pork belly ₱260 → ₱275/kg (price rose at market)',
      payload: { kind: 'recipe_costing', recipeId: 'rec-sinigang', recipeName: 'Pork Sinigang' },
      requested_at: daysAgo(1), resolved_at: null,
      requester: { name: 'Ben Santos' }, resolver: null,
    },
    {
      id: 'apr-2', change_type: 'recipe_ingredients', status: 'pending',
      summary: 'Edit ingredients — Chicken Adobo: Garlic 60 g → 80 g',
      payload: { kind: 'recipe_ingredients', recipeId: 'rec-adobo', recipeName: 'Chicken Adobo' },
      requested_at: daysAgo(1), resolved_at: null,
      requester: { name: 'Rosa Aquino' }, resolver: null,
    },
    {
      id: 'apr-3', change_type: 'purchase', status: 'pending',
      summary: 'Restock — Cooking oil +4 L from MetroFresh Grocery (₱368)',
      payload: { kind: 'purchase', ingredientName: 'Cooking oil' },
      requested_at: daysAgo(0), resolved_at: null,
      requester: { name: 'Mika del Rosario' }, resolver: null,
    },
    {
      id: 'apr-4', change_type: 'recipe_edit', status: 'approved',
      summary: 'Recipe updated — Beef Bulalo: Price (for 6) ₱750 → ₱780',
      payload: {}, requested_at: daysAgo(3), resolved_at: daysAgo(3),
      requester: { name: 'Ben Santos' }, resolver: { name: 'Nena Reyes' },
    },
    {
      id: 'apr-5', change_type: 'purchase', status: 'rejected',
      summary: 'Restock — Rice +50 kg (duplicate of this morning)',
      payload: {}, requested_at: daysAgo(4), resolved_at: daysAgo(4),
      requester: { name: 'Rosa Aquino' }, resolver: { name: 'Nena Reyes' },
    },
  ],

  // latest movement per item per kind — drives the "counted N days ago" ages.
  stock_item_status: buildStatus(),

  // a full daily series for Chicken, so the stock chart has something to draw.
  stock_movements: chickenSeries(),

  kitchen_settings: [{ key: 'staff_direct_restock', value: false }],
  waste_log: [],
  purchases: [],
  activity_log: [],
  recipe_ingredients: [],
  finance_item_map: [],
  finance_reconciliations: [],
  entries: [],
}

// --- helpers -------------------------------------------------------------

function ing(id, name, unit, quantity, min, cost, supplierId, meal, shelf, notes) {
  const sup = fixturesSupplierName(supplierId)
  return {
    id, name, unit, quantity, min_threshold: min, cost_per_unit: cost,
    meal_tag: meal, aliases: [], supplier_id: supplierId,
    supplier: sup ? { name: sup } : null,
    shelf_life_days: shelf, notes, archived_at: null,
  }
}
function fixturesSupplierName(id) {
  const map = {
    'sup-market': 'Bayan Public Market', 'sup-grocery': 'MetroFresh Grocery',
    'sup-dairy': 'Sunrise Dairy', 'sup-grains': 'Golden Grains Trading',
  }
  return map[id] ?? null
}
function recipe(id, name, category, pax, avail, meal, tiers, costLines, lines) {
  return {
    id, name, category, pax_tier: pax, is_available: avail, meal_tag: meal,
    tiers, cost_lines: costLines, lines,
    prep_instructions: null, video_url: null, image_url: null, links: [],
  }
}
function cline(name, unit, qty, costs) { return { name, unit, qty, costs } }
function rline(ingredient_id, name, unit, quantity, cost) {
  return { id: 'rl-' + ingredient_id, ingredient_id, quantity, unit, ingredient: { name, unit, cost_per_unit: cost } }
}

function buildStatus() {
  const rows = []
  const add = (id, kind, n, qty) => rows.push({ ingredient_id: id, kind, occurred_at: daysAgo(n), qty_after: qty })
  add('ing-chicken', 'count', 1, 8); add('ing-chicken', 'purchase', 2, 12)
  add('ing-porkbelly', 'count', 2, 6); add('ing-porkbelly', 'purchase', 3, 10)
  add('ing-bangus', 'count', 4, 4)
  add('ing-rice', 'count', 1, 40); add('ing-rice', 'purchase', 5, 50)
  add('ing-egg', 'count', 3, 90); add('ing-egg', 'purchase', 6, 120)
  add('ing-onion', 'count', 6, 0.4)
  add('ing-milk', 'count', 5, 0.5)
  add('ing-coffee', 'count', 8, 300)
  return rows
}

function chickenSeries() {
  const rows = []
  let mid = 'm0'
  const push = (n, kind, delta, qty) => rows.push({
    id: (mid = 'm' + rows.length), ingredient_id: 'ing-chicken', kind,
    delta, qty_after: qty, occurred_at: daysAgo(n), servings: null, note: null,
    actor: { name: 'Nena Reyes' }, recipe: kind === 'use' ? { name: 'Chicken Adobo' } : null,
  })
  push(13, 'add', 6, 6)
  push(11, 'purchase', 6, 12)
  push(10, 'count', 0, 12)
  push(8, 'use', -2, 10)
  push(6, 'count', -1, 9)
  push(4, 'use', -3, 6)
  push(2, 'purchase', 6, 12)
  push(1, 'count', 0, 8)
  return rows.reverse() // newest first, like PostgREST desc — mock re-sorts anyway
}
