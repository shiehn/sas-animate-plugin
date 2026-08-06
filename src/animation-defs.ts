/**
 * Animation type metadata — drives the panel menu, per-card param clusters,
 * defaults, and preset chips. Pure data + helpers; no host access.
 *
 * Only types the host can compile TODAY are listed (slice 1). Later slices
 * append entries here as their mechanisms land host-side; the SDK's
 * `AnimationType` union is the superset wire vocabulary.
 */

export type AnimationFamily = 'cyclic' | 'phrase' | 'reactive' | 'lab';

export interface AnimationTypeDef {
  /** SDK AnimationType token. */
  type: string;
  label: string;
  family: AnimationFamily;
  /** One-line, user-facing. */
  blurb: string;
  /** Which param knobs the card shows, in order. */
  knobs: readonly AnimationKnob[];
  /** Spec params applied when the animation is first added. */
  defaults: Record<string, number | string | boolean | number[]>;
  /** Preset chips (id + label) mapped to param overrides. */
  presets?: readonly { id: string; label: string; params: Record<string, number | string> }[];
  /** True when the type needs listen sources (family C). */
  needsListen?: boolean;
}

export type AnimationKnob =
  | 'amount'
  | 'rate'
  | 'shape'
  | 'filterKind'
  | 'depthOct'
  | 'baseHz'
  | 'resonance'
  | 'lengthBars'
  | 'phaseSpread';

/** Musical rate tokens → period in QUARTER-NOTES (the platform convention:
 *  '1/4' = 1 qn, one 4/4 bar = 4 qn — mirrors bus-tools RATE_TOKEN_QN). */
export const RATE_QN: Record<string, number> = {
  '4bar': 16,
  '2bar': 8,
  '1bar': 4,
  '1/2': 2,
  '1/4': 1,
  '1/8': 0.5,
  '1/8T': 1 / 3,
  '1/16': 0.25,
  '1/16T': 1 / 6,
  '1/32': 0.125,
};

const cyclic = (def: Omit<AnimationTypeDef, 'family'>): AnimationTypeDef => ({ ...def, family: 'cyclic' });
const phrase = (def: Omit<AnimationTypeDef, 'family'>): AnimationTypeDef => ({ ...def, family: 'phrase' });
const reactive = (def: Omit<AnimationTypeDef, 'family'>): AnimationTypeDef => ({
  ...def,
  family: 'reactive',
  needsListen: true,
});
const lab = (def: Omit<AnimationTypeDef, 'family'>): AnimationTypeDef => ({ ...def, family: 'lab' });

export const ANIMATION_DEFS: readonly AnimationTypeDef[] = [
  // ── Cyclic ────────────────────────────────────────────────────────────
  cyclic({
    type: 'pumper',
    label: 'Pumper',
    blurb: 'Sidechain-style volume pump on a fixed grid — no kick required.',
    knobs: ['amount', 'rate'],
    defaults: { amount: 0.6, rateQn: 1 },
    presets: [
      { id: 'subtle', label: 'Subtle', params: { presetId: 'subtle' } },
      { id: 'classic', label: 'Classic', params: { presetId: 'classic' } },
      { id: 'hard', label: 'Hard', params: { presetId: 'hard' } },
    ],
  }),
  cyclic({
    type: 'autopan',
    label: 'Autopan',
    blurb: 'Pan swings left↔right at a musical rate.',
    knobs: ['amount', 'rate', 'shape'],
    defaults: { amount: 0.7, rateQn: 4, shape: 'sine' },
  }),
  cyclic({
    type: 'tremolo',
    label: 'Tremolo',
    blurb: 'Fast volume wobble — sine for vintage amp, square for helicopter.',
    knobs: ['amount', 'rate', 'shape'],
    defaults: { amount: 0.5, rateQn: 0.5, shape: 'sine' },
  }),
  cyclic({
    type: 'trance-gate',
    label: 'Trance Gate',
    blurb: 'Rhythmic on/off chop for pads and sustained material.',
    knobs: ['amount', 'rate'],
    defaults: { amount: 0.8, rateQn: 0.25 },
    presets: [
      { id: 'gate-8', label: '1/8', params: { rateQn: 0.5 } },
      { id: 'gate-16', label: '1/16', params: { rateQn: 0.25 } },
    ],
  }),
  // ── Phrase ────────────────────────────────────────────────────────────
  phrase({
    type: 'fade-in',
    label: 'Fade In',
    blurb: 'Track enters over N bars from silence.',
    knobs: ['lengthBars'],
    defaults: { amount: 1, lengthBars: 4 },
  }),
  phrase({
    type: 'fade-out',
    label: 'Fade Out',
    blurb: 'Track dissolves over the last N bars of the loop.',
    knobs: ['lengthBars'],
    defaults: { amount: 1, lengthBars: 4 },
  }),
  phrase({
    type: 'dj-filter',
    label: 'DJ Filter',
    blurb: 'One-knob HP or LP sweep across the whole loop — the club transition tool.',
    knobs: ['amount', 'filterKind', 'resonance'],
    defaults: { amount: 0.8, filter: 'hp', resonance01: 0.3 },
  }),
  phrase({
    type: 'riser',
    label: 'Riser',
    blurb: 'High-pass sweep climbs into the loop end — tension into the next section.',
    knobs: ['amount', 'resonance'],
    defaults: { amount: 0.8, filter: 'hp', resonance01: 0.45 },
  }),
  // ── Reactive ──────────────────────────────────────────────────────────
  reactive({
    type: 'duck',
    label: 'Duck',
    blurb: 'Targets dip when the source hits — classic sidechain pump off any track.',
    knobs: ['amount'],
    defaults: { amount: 0.6, presetId: 'classic' },
    presets: [
      { id: 'subtle', label: 'Subtle', params: { presetId: 'subtle' } },
      { id: 'classic', label: 'Classic', params: { presetId: 'classic' } },
      { id: 'hard', label: 'Hard', params: { presetId: 'hard' } },
    ],
  }),
  // ── Lab ───────────────────────────────────────────────────────────────
  lab({
    type: 'stutter',
    label: 'Stutter Gate',
    blurb: 'Very fast gate chop — glitch texture on anything sustained.',
    knobs: ['amount', 'rate'],
    defaults: { amount: 0.85, rateQn: 0.125 },
  }),
  lab({
    type: 'drunk-walk',
    label: 'Drunk Walk',
    blurb: 'Stepped random wander on the filter — deterministic, repeats with the loop.',
    knobs: ['amount', 'rate', 'depthOct', 'baseHz'],
    defaults: { amount: 0.6, rateQn: 1, shape: 'random', filter: 'lp', depthOct: 3, baseHz: 4000 },
  }),
  lab({
    type: 'breathe',
    label: 'Breathing Mix',
    blurb: 'Slow volume undulation across the targets, phase-spread for movement.',
    knobs: ['amount', 'rate', 'phaseSpread'],
    defaults: { amount: 0.3, rateQn: 8, shape: 'sine', phaseSpread: true },
  }),
];

export const ANIMATION_DEF_BY_TYPE: ReadonlyMap<string, AnimationTypeDef> = new Map(
  ANIMATION_DEFS.map((d) => [d.type, d])
);

export const FAMILY_LABELS: Record<AnimationFamily, string> = {
  cyclic: 'Cyclic',
  phrase: 'Phrase',
  reactive: 'Reactive',
  lab: 'Lab',
};

export const FAMILY_ORDER: readonly AnimationFamily[] = ['cyclic', 'phrase', 'reactive', 'lab'];
