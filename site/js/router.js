// router.js — pure routing function. No DOM, no network, no side effects.
// Input:  { intent, state, county } where intent is one of
//         'lost_paper' | 'history' | 'handle_it' | 'vin_only'
// Output: { type: 'cards', cards: [...] }
//         { type: 'explainer', page: 'vin.html', cards: [] }   (vin_only)
//         { type: 'cannot-route', reason, cards: [] }
// Note: 'vin_only' is handled here but must never appear as a card's for_intent
// in data — validate.mjs enforces that on purpose, because no court URL may
// present itself as a VIN lookup.
const ALLOWED_VERIFICATION = new Set(['link_ok', 'keys_documented', 'handoff_tested']);

export function route(data, query) {
  const { intent, state, county } = query || {};

  if (intent === 'vin_only') {
    return { type: 'explainer', page: 'vin.html', cards: [] };
  }
  if (!data || data.state !== state) {
    return { type: 'cannot-route', reason: 'unknown-state', cards: [] };
  }

  const cards = (data.cards || [])
    .filter((c) => Array.isArray(c.for_intents) && c.for_intents.includes(intent))
    .filter((c) => {
      const counties = c.for_counties || [];
      if (counties.includes('*')) {
        return !(c.exclude_counties || []).includes(county);
      }
      return counties.includes(county);
    })
    .filter((c) => ALLOWED_VERIFICATION.has(c.verification))
    .slice()
    .sort((a, b) => (a.weight || 0) - (b.weight || 0));

  if (cards.length === 0) {
    return { type: 'cannot-route', reason: 'no-cards', cards: [] };
  }
  return { type: 'cards', cards };
}

export const INTENTS = ['lost_paper', 'history', 'handle_it', 'vin_only'];
