import { spellData } from '../data/spells';
import { throwAimTarget, throwCandidates } from '../sim/combat';
import { spellAtPoint, spellCandidates } from '../sim/spells';
import type { Monster, World } from '../sim/world';

export type Aim = { readonly kind: 'spell'; readonly id: string } | { readonly kind: 'throw' };

export interface AimResult {
  readonly spell?: { readonly id: string; readonly x: number; readonly y: number };
  readonly throw?: boolean;
  readonly throwAt?: { readonly x: number; readonly y: number };
}

export interface AimState {
  readonly aim: Aim;
  readonly focus: Monster | undefined;
  readonly pressing: boolean;
  readonly point?: { readonly x: number; readonly y: number };
}

interface ScreenPoint {
  readonly u: number;
  readonly v: number;
}

/** Picks the creature whose projected body is nearest the pointer. */
export function nearestOnScreen(
  candidates: readonly Monster[],
  pointer: ScreenPoint,
  project: (monster: Monster, height: number) => ScreenPoint | undefined,
  aspect: number,
  maxDistance = 0.07,
): Monster | undefined {
  let nearest: Monster | undefined;
  let best = maxDistance;
  for (const monster of candidates) {
    const foot = project(monster, 0);
    const body = project(monster, 0.55);
    if (!foot || !body) continue;
    const ax = (foot.u - pointer.u) * aspect;
    const ay = foot.v - pointer.v;
    const bx = (body.u - pointer.u) * aspect;
    const by = body.v - pointer.v;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
    const distance = Math.hypot(ax + dx * t, ay + dy * t);
    if (distance <= best) {
      best = distance;
      nearest = monster;
    }
  }
  return nearest;
}

function targetAt(w: World, state: AimState, point: { readonly x: number; readonly y: number }, picked?: Monster): Monster | undefined {
  return (
    picked ??
    (state.aim.kind === 'throw' ? throwAimTarget(w, point.x, point.y) : spellAtPoint(w, spellData(state.aim.id), point.x, point.y))
  );
}

function pointState(
  w: World,
  state: AimState,
  point: { readonly x: number; readonly y: number },
  pressing: boolean,
  picked?: Monster,
): AimState {
  const focus = targetAt(w, state, point, picked);
  return { ...state, focus: pressing ? focus : (focus ?? state.focus), pressing, point };
}

export function startAim(w: World, aim: Aim): AimState {
  const focus = aim.kind === 'throw' ? throwCandidates(w)[0] : spellCandidates(w, spellData(aim.id))[0];
  return { aim, focus, pressing: false };
}

export function aimHover(w: World, state: AimState, point: { readonly x: number; readonly y: number }, picked?: Monster): AimState {
  return state.pressing ? state : pointState(w, state, point, false, picked);
}

export function aimPress(w: World, state: AimState, point: { readonly x: number; readonly y: number }, picked?: Monster): AimState {
  return pointState(w, state, point, true, picked);
}

export function aimDrag(w: World, state: AimState, point: { readonly x: number; readonly y: number }, picked?: Monster): AimState {
  return state.pressing ? pointState(w, state, point, true, picked) : state;
}

export function aimRelease(_w: World, state: AimState): AimResult | undefined {
  if (!state.point) return undefined;
  if (state.aim.kind === 'throw') {
    return state.focus ? { throwAt: { x: state.focus.x, y: state.focus.y } } : { throwAt: state.point };
  }
  return state.focus ? { spell: { id: state.aim.id, x: state.focus.x, y: state.focus.y } } : undefined;
}

export function aimConfirm(_w: World, state: AimState): AimResult | undefined {
  if (state.aim.kind === 'throw') {
    return state.focus ? { throwAt: { x: state.focus.x, y: state.focus.y } } : { throw: true };
  }
  return state.focus ? { spell: { id: state.aim.id, x: state.focus.x, y: state.focus.y } } : undefined;
}
