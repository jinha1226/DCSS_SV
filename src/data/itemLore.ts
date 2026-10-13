import { itemDefinition, type ItemEffect } from './itemCatalog';
import rawLore from './json/lore.json';

interface LoreEntry {
  /** The DCSS item it is taken from, as named in crawl's descript files. */
  readonly dcss: string;
  readonly text: string;
}

const LORE: Readonly<Record<string, LoreEntry>> = Object.fromEntries(
  Object.entries(rawLore).filter((entry): entry is [string, LoreEntry] => !entry[0].startsWith('_')),
);

/** Staves, rods and spellbooks share one description per school, whatever their tier. */
const loreKey = (id: string): string => id.replace(/^(staff|rod|spellbook)_([a-z]+)_\d$/, '$1_$2');

/** The DCSS description of an item (by catalogue id or weapon base id), if crawl has one. */
export function itemLore(id: string): string | undefined {
  return LORE[loreKey(id)]?.text;
}

const EFFECT_TEXT: Readonly<Record<string, (p: number) => string>> = {
  heal: (p) => `체력을 ${p} 회복한다.`,
  restore_mana: (p) => `마력을 ${p} 회복한다.`,
  might: (p) => `${p}초 동안 근접 공격의 위력이 크게 오른다.`,
  haste: (p) => `${p}초 동안 행동이 빨라진다.`,
  cure: () => '독을 해독한다.',
  poison: (p) => `마시면 ${p}초 동안 중독된다.`,
  enchant_weapon: (p) => `든 무기를 +${p} 강화한다. (최대 +9, 아티팩트 불가)`,
  enchant_armour: (p) => `입고 있는 방어구 하나를 +${p} 강화한다.`,
  remove_curse: () => '착용한 장비의 저주를 모두 푼다.',
  confusion: (p) => `반경 ${p}칸 안의 적을 혼란에 빠뜨린다.`,
  identify: () => '감정되지 않은 소모품 하나의 정체를 밝힌다.',
  fear: (p) => `반경 ${p}칸 안의 적을 겁에 질리게 한다.`,
  teleport: () => '층 안의 먼 곳으로 순간이동한다.',
  blink: (p) => `${p}칸 안의 다른 곳으로 순간이동한다.`,
  lightning: (p) => `가장 가까운 적에게 번개를 쏘아 ${p}의 전격 피해를 준다.`,
  armour: (p) => `방어 +${p}`,
  shield: (p) => `방패 +${p}`,
  fire_resist: (p) => `화염 저항 ${'+'.repeat(Math.max(1, p))}`,
  cold_resist: (p) => `냉기 저항 ${'+'.repeat(Math.max(1, p))}`,
};

/** What an item does in this game, in short lines: the numbers behind the DCSS description. */
export function effectLines(id: string): string[] {
  let effects: readonly ItemEffect[];
  try {
    effects = itemDefinition(id).effects;
  } catch {
    return [];
  }
  return effects.flatMap((e) => {
    const text = EFFECT_TEXT[e.id];
    return text ? [text(e.power ?? 0)] : [];
  });
}
