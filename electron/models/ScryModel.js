import { db } from '../db/connection.js';

export function listSets() {
  return db().prepare(`
    SELECT code, name, released_at
    FROM scry_sets
    ORDER BY released_at DESC NULLS LAST, name ASC
  `).all();
}

export function setInfo(code) {
  const info = db().prepare(`
    SELECT code, name, released_at
    FROM scry_sets
    WHERE code = ?
  `).get(code);

  const count = db().prepare(`
    SELECT COUNT(*) AS n
    FROM scry_cards
    WHERE set_code = ?
  `).get(code)?.n ?? 0;

  return { ...info, count };
}

export function cardsBySet(code) {
  // collector_number puede tener letras. Orden: num primero, luego texto.
  return db().prepare(`
    SELECT id, name, collector_number, rarity, eur, eur_foil, image_small, image_normal
    FROM scry_cards
    WHERE set_code = ?
    ORDER BY
      CASE
        WHEN CAST(collector_number AS INTEGER) IS NOT NULL THEN CAST(collector_number AS INTEGER)
        ELSE NULL
      END ASC,
      collector_number ASC
  `).all(code);
}
