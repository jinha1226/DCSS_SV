# Damage and resistances

Physical damage: `amount > 0 ? max(1, round(amount - armour)) : 0`. Only physical damage is reduced by armour.

Elemental damage: `round(amount * resistanceFactor(target.resists[element] ?? 0))`. Armour does not affect it.

| Resistance | Multiplier |
| --- | --- |
| -1 | 2 |
| 0 | 1 |
| +1 | 0.5 |
| +2 | 0.25 |
| +3 | 0 (immune) |

Types: fire, cold, electric, poison, negative. Both heroes (`species.json: resists`) and monsters (`monsters.json: resists`) can supply resistance values. Monsters can optionally set `armour` and `elemental: {type, damage}` on their attack. An attack with both parts applies their defences separately and adds the actual HP losses.

Damage popup: physical damage uses the existing normal-hit popup; elemental damage emits a separate `elemental` event, using orange (fire), cyan (cold), yellow (electric), green (poison) and violet (negative). A resisted elemental hit shows grey `0`. Burning shows integer damage increments instead of emitting tiny per-frame decimal numbers.

Weapon flame brands retain their damage-over-time and now also deal an immediate elemental hit using their `damage` value. Lightning chains use the same elemental damage formula. Conjuration spells retain their neutral magic damage; fire spells use fire resistance.

Existing dodge, shield, parry, timing and cooldowns are unchanged.
