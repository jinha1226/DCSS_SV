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

function targetAt(w: World, state: AimState, point: { readonly x: number; readonly y: number }): Monster | undefined {
  return state.aim.kind === 'throw' ? throwAimTarget(w, point.x, point.y) : spellAtPoint(w, spellData(state.aim.id), point.x, point.y);
}

function pointState(w: World, state: AimState, point: { readonly x: number; readonly y: number }, pressing: boolean): AimState {
  return { ...state, focus: targetAt(w, state, point) ?? state.focus, pressing, point };
}

export function startAim(w: World, aim: Aim): AimState {
  const focus = aim.kind === 'throw' ? throwCandidates(w)[0] : spellCandidates(w, spellData(aim.id))[0];
  return { aim, focus, pressing: false };
}

export function aimHover(w: World, state: AimState, point: { readonly x: number; readonly y: number }): AimState {
  return state.pressing ? state : pointState(w, state, point, false);
}

export function aimPress(w: World, state: AimState, point: { readonly x: number; readonly y: number }): AimState {
  return pointState(w, state, point, true);
}

export function aimDrag(w: World, state: AimState, point: { readonly x: number; readonly y: number }): AimState {
  return state.pressing ? pointState(w, state, point, true) : state;
}

export function aimRelease(w: World, state: AimState): AimResult | undefined {
  if (!state.point) return undefined;
  const target = targetAt(w, state, state.point);
  if (state.aim.kind === 'throw') {
    return target ? { throwAt: { x: target.x, y: target.y } } : { throwAt: state.point };
  }
  return target ? { spell: { id: state.aim.id, x: target.x, y: target.y } } : undefined;
}

export function aimConfirm(_w: World, state: AimState): AimResult | undefined {
  if (state.aim.kind === 'throw') {
    return state.focus ? { throwAt: { x: state.focus.x, y: state.focus.y } } : { throw: true };
  }
  return state.focus ? { spell: { id: state.aim.id, x: state.focus.x, y: state.focus.y } } : undefined;
}
