import { hasTile, type TileName } from '../data/tiles';
import { downDestinations, type Branch } from '../sim/dungeonGraph';
import type { World } from '../sim/world';

const SLUG: Readonly<Partial<Record<Branch, string>>> = {
  Lair: 'lair',
  Orc: 'orc',
  Temple: 'temple',
  Snake: 'snake',
  Spider: 'spider',
  Swamp: 'swamp',
  Shoals: 'shoals',
  Vaults: 'vaults',
};

/**
 * Branches whose own DCSS entrance is on crawl's unknown-licence list (and missing from the 2010
 * release): a free gateway from the library that suits the place stands in.
 */
const ENTRANCE_STAND_INS: Readonly<Partial<Record<Branch, string>>> = {
  Temple: 'dcss/dngn/gateways/enter_depths',
  Swamp: 'dcss/dngn/gateways/slimy_stairs_down',
  Shoals: 'dcss/dngn/gateways/portal',
};

/** Zot's gate stays shut, as in DCSS, until the hero carries the runes it asks for. */
const ZOT_RUNES = 2;

/**
 * The DCSS feature drawn for the stairs at (x, y): plain stone stairs within a branch, the branch's
 * own gateway where a down stair enters another branch, and its exit on the way back up out of it.
 * Entrances whose own tiles are not free to reuse use a stand-in (ENTRANCE_STAND_INS); a branch's
 * way out shows its entrance gateway, since DCSS's exit tiles are not free to reuse either.
 */
export function stairTile(w: World, x: number, y: number, down: boolean): TileName {
  const tile = gatewayTile(w, x, y, down);
  if (hasTile(tile)) return tile as TileName;
  return (down ? 'feat/stone_stairs_down' : 'feat/stone_stairs_up') as TileName;
}

/** The gateway into `branch`, as drawn on the stair that leads into it. */
function entranceTile(w: World, branch: Branch): string {
  if (branch === 'Zot') return `dngn/gateways/enter_zot_${w.runes.size >= ZOT_RUNES ? 'open' : 'closed'}`;
  if (branch === 'Vaults') return 'dngn/gateways/enter_vaults_open';
  const standIn = ENTRANCE_STAND_INS[branch];
  if (standIn) return standIn;
  const slug = SLUG[branch];
  return slug ? `dngn/gateways/enter_${slug}` : 'feat/stone_stairs_down';
}

function gatewayTile(w: World, x: number, y: number, down: boolean): string {
  const here = w.dungeonGraph.nodes.get(w.depth);
  if (!down) {
    if (!here || here.floor !== 1 || here.branch === 'Dungeon') return 'feat/stone_stairs_up';
    if (here.branch === 'Zot') return 'dngn/gateways/return_zot';
    // DCSS's own exits are not free to reuse; the way out shows the branch's gateway, seen from inside.
    const exit = `dngn/gateways/exit_${SLUG[here.branch] ?? ''}`;
    return hasTile(exit) ? exit : entranceTile(w, here.branch);
  }
  const index = w.stairs.filter((s) => s.down).findIndex((s) => s.x === x && s.y === y);
  const target = w.dungeonGraph.nodes.get(downDestinations(w.dungeonGraph, w.depth)[index] ?? -1);
  if (!target || target.branch === here?.branch) return 'feat/stone_stairs_down';
  return entranceTile(w, target.branch);
}

/** True when a stair tile is a branch gateway (an entrance, exit or stand-in) rather than plain stone stairs. */
export function isGatewayTile(tile: string): boolean {
  return tile.startsWith('dngn/gateways/') || tile.startsWith('dcss/dngn/gateways/');
}

/** True when the stairs at (x, y) are a branch gateway rather than plain stone stairs. */
export function isGateway(w: World, x: number, y: number, down: boolean): boolean {
  return isGatewayTile(stairTile(w, x, y, down));
}
