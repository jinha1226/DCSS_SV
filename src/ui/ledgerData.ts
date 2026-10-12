import { itemDefinition } from '../data/itemCatalog';
import type { ResistName } from '../data/items';
import type { TileName } from '../data/tiles';
import type { GearSlot } from '../sim/gear';
import { itemTile } from '../sim/identification';
import { activeTraining, MAX_SKILL, skillXpToNext, xpToNext } from '../sim/skills';
import type { World } from '../sim/world';
import { bagEntries, equipmentSlots } from './inventorySheets';
import { listedSkills } from './skillBar';
import { statusValues } from './statusSheet';

/** The DCSS console colours the ledger speaks in. */
export type Tone = 'plain' | 'hi' | 'good' | 'warn' | 'bad' | 'muted' | 'gold' | 'cyan' | 'magic';

export interface Pair {
  readonly label: string;
  readonly value: string;
  readonly tone: Tone;
}

/** Letters items are listed under, as in DCSS. */
export const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** How full a pool is, coloured the way DCSS colours HP: green, then yellow, then red. */
export function poolTone(now: number, max: number): Tone {
  const share = max > 0 ? now / max : 0;
  return share >= 0.66 ? 'good' : share >= 0.33 ? 'warn' : 'bad';
}

/** The three short columns at the top of the % screen. */
export function overviewColumns(w: World): Pair[][] {
  const v = statusValues(w).vitals;
  const value = (label: string): string => v.find((p) => p.label === label)?.value ?? '';
  const need = xpToNext(w.hero.level);
  return [
    [
      { label: '체력', value: `${Math.ceil(w.hero.hp)}/${w.hero.maxHp}`, tone: poolTone(w.hero.hp, w.hero.maxHp) },
      {
        label: '마력',
        value: `${Math.floor(w.hero.mana)}/${w.hero.maxMana}`,
        tone: w.hero.maxMana > 0 ? poolTone(w.hero.mana, w.hero.maxMana) : 'muted',
      },
      { label: '금화', value: String(w.gold), tone: 'gold' },
    ],
    [
      { label: '물리감소', value: value('물리감소'), tone: 'hi' },
      { label: '회피', value: value('회피확률'), tone: 'hi' },
      { label: '방패', value: value('방패확률'), tone: 'hi' },
    ],
    [
      { label: '레벨', value: String(w.hero.level), tone: 'hi' },
      { label: '경험', value: Math.floor((Math.min(1, w.hero.xp / need) || 0) * 100) + '%', tone: 'plain' },
      { label: '처치', value: String(w.kills), tone: 'plain' },
    ],
  ];
}

const RESISTS: readonly { id: ResistName; label: string }[] = [
  { id: 'fire', label: '화염' },
  { id: 'cold', label: '냉기' },
  { id: 'electric', label: '전기' },
  { id: 'poison', label: '독' },
  { id: 'negative', label: '음에너지' },
];

/** Resistances as DCSS pips: '+' for each level held, 'x' for each level of weakness, '.' otherwise. */
export function resistPips(w: World): { label: string; pips: string }[] {
  return RESISTS.map(({ id, label }) => {
    const level = Math.max(-3, Math.min(3, w.heroDef.resists[id] ?? 0));
    const mark = level >= 0 ? '+' : 'x';
    const pips = Array.from({ length: 3 }, (_, i) => (i < Math.abs(level) ? mark : '.')).join(' ');
    return { label, pips };
  });
}

export interface ItemRow {
  /** Bag entry id, or 'slot:<id>' for an equipment slot. */
  readonly key: string;
  readonly letter: string;
  readonly name: string;
  readonly note: string;
  readonly tile?: TileName;
  readonly tone: Tone;
  readonly kind: 'weapon' | 'gear' | 'consumable' | 'other';
  readonly equipped: boolean;
}

function tileOf(id: string): TileName | undefined {
  try {
    return itemDefinition(id).tile as TileName;
  } catch {
    return undefined;
  }
}

/** The ten worn slots, lettered a) to j) like the DCSS equipment list. */
export function equipmentRows(w: World): (ItemRow & { slot: string; available: boolean })[] {
  return equipmentSlots(w).map((slot, i) => {
    const worn = slot.id === 'weapon' ? w.weapon.baseId : w.gear[slot.id as GearSlot];
    const tile = slot.id === 'weapon' ? w.weapon.tile : worn ? tileOf(worn) : undefined;
    return {
      key: 'slot:' + slot.id,
      letter: LETTERS[i] ?? '?',
      slot: slot.name,
      available: slot.available,
      name: slot.value,
      note: slot.available ? '' : '양손 무기 사용 중',
      ...(tile ? { tile } : {}),
      tone: worn ? (w.cursedGear.has(worn) ? 'bad' : 'hi') : 'muted',
      kind: slot.id === 'weapon' ? 'weapon' : 'gear',
      equipped: Boolean(worn),
    };
  });
}

const GROUPS: readonly { kind: ItemRow['kind']; title: string }[] = [
  { kind: 'weapon', title: '무기' },
  { kind: 'gear', title: '방어구 · 장신구' },
  { kind: 'consumable', title: '소모품' },
  { kind: 'other', title: '기타' },
];

/** The bag in DCSS inventory order: grouped by kind, lettered straight through. */
export function bagGroups(w: World): { title: string; rows: ItemRow[] }[] {
  const rows: Omit<ItemRow, 'letter'>[] = bagEntries(w).map((entry) => {
    const stored = w.inventory.find((item) => item.uid === entry.id);
    if (entry.id === w.weapon.uid) {
      return { key: entry.id, name: entry.name, note: '장착 중', tile: w.weapon.tile, tone: 'hi', kind: 'weapon', equipped: true };
    }
    if (entry.id === 'offhand-equipped' && w.gear.offhand) {
      const tile = tileOf(w.gear.offhand);
      return { key: entry.id, name: entry.name, note: '장착 중', ...(tile ? { tile } : {}), tone: 'hi', kind: 'gear', equipped: true };
    }
    if (stored?.kind === 'weapon') {
      return { key: entry.id, name: entry.name, note: '', tile: stored.weapon.tile, tone: 'plain', kind: 'weapon', equipped: false };
    }
    if (stored?.kind === 'gear' || stored?.kind === 'consumable') {
      const consumable = stored.kind === 'consumable';
      const tile = consumable ? (itemTile(w, stored.id) as TileName | undefined) : tileOf(stored.id);
      return {
        key: entry.id,
        name: entry.name,
        note: consumable && entry.count > 1 ? '×' + entry.count : '',
        ...(tile ? { tile } : {}),
        tone: consumable ? (w.identifiedItems.has(stored.id) ? 'plain' : 'cyan') : 'plain',
        kind: consumable ? 'consumable' : 'gear',
        equipped: false,
      };
    }
    const tile = entry.id === 'ammo' ? ('item/boomerang1' as TileName) : undefined;
    return {
      key: entry.id,
      name: entry.name,
      note: entry.count > 1 || entry.id === 'ammo' ? '×' + entry.count : '',
      ...(tile ? { tile } : {}),
      tone: entry.id.startsWith('rune') || entry.id.startsWith('orb') ? 'magic' : 'plain',
      kind: 'other',
      equipped: false,
    };
  });
  let n = 0;
  return GROUPS.map(({ kind, title }) => ({
    title,
    rows: rows.filter((r) => r.kind === kind).map((r) => ({ ...r, letter: LETTERS[n++] ?? '?' })),
  })).filter((g) => g.rows.length);
}

export interface SkillRow {
  readonly id: string;
  readonly letter: string;
  readonly name: string;
  readonly level: number;
  /** Progress to the next level, 0-99. */
  readonly percent: number;
  readonly training: boolean;
  readonly description: string;
}

/** Skills as the DCSS m screen lists them: level, progress toward the next, '+' when being trained. */
export function skillRows(w: World): SkillRow[] {
  const training = new Set(activeTraining(w));
  return listedSkills(w).map((s, i) => ({
    id: s.id,
    letter: LETTERS[i] ?? '?',
    name: s.name,
    level: s.level,
    percent: s.level >= MAX_SKILL ? 0 : Math.min(99, Math.floor((s.progress / skillXpToNext(s.level)) * 100)),
    training: training.has(s.id),
    description: s.description,
  }));
}
