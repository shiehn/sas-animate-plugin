/**
 * AnimationCard — one animation's controls. Knob clusters are driven by the
 * type's metadata (animation-defs.ts); every gesture calls onChange with the
 * FULL updated spec (the panel debounces host pushes).
 */

import React from 'react';
import type { AnimationSpec, SceneTrackSummary } from '@signalsandsorcery/plugin-sdk';
import { ANIMATION_DEF_BY_TYPE, RATE_QN } from '../animation-defs';
import { TargetPicker } from './TargetPicker';
import { palette, styles } from './styles';

export interface AnimationCardProps {
  spec: AnimationSpec;
  tracks: SceneTrackSummary[];
  /** Trigger-onset census from the host (reactive types). */
  onsetCount?: number;
  /** Card-scoped error (e.g. a slot conflict) to surface inline. */
  error?: string;
  onChange: (spec: AnimationSpec) => void;
  onRemove: (animationId: string) => void;
}

const SHAPE_OPTIONS = ['sine', 'triangle', 'saw', 'square', 'random'] as const;
const LENGTH_BARS_OPTIONS = [1, 2, 4, 8, 16] as const;

function rateLabel(qn: number): string {
  for (const [token, value] of Object.entries(RATE_QN)) {
    if (Math.abs(value - qn) < 1e-6) return token;
  }
  return `${qn}qn`;
}

export function AnimationCard({
  spec,
  tracks,
  onsetCount,
  error,
  onChange,
  onRemove,
}: AnimationCardProps): React.ReactElement {
  const def = ANIMATION_DEF_BY_TYPE.get(spec.type);

  const patchParams = (patch: Partial<AnimationSpec['params']>): void => {
    onChange({ ...spec, params: { ...spec.params, ...patch } });
  };

  const knobs = def?.knobs ?? ['amount'];
  const showKnob = (knob: string): boolean => knobs.includes(knob as never);

  return (
    <div style={styles.card} data-testid={`animation-card-${spec.type}`}>
      <div style={styles.cardHeader}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={spec.enabled}
            onChange={(e) => onChange({ ...spec, enabled: e.target.checked })}
            aria-label={`${def?.label ?? spec.type} enabled`}
          />
          <span style={styles.cardTitle}>{def?.label ?? spec.type}</span>
        </label>
        {def?.family === 'lab' && (
          <span style={{ ...styles.chip, cursor: 'default' }}>Lab</span>
        )}
        {onsetCount !== undefined && (
          <span style={{ color: palette.textFaint, fontSize: 10 }}>
            {onsetCount} trigger{onsetCount === 1 ? '' : 's'}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          style={styles.iconButton}
          onClick={() => onRemove(spec.id)}
          aria-label={`remove ${def?.label ?? spec.type}`}
        >
          ✕
        </button>
      </div>
      {def && <div style={styles.cardBlurb}>{def.blurb}</div>}
      {error && <div style={styles.errorBar}>{error}</div>}

      <TargetPicker
        label="Targets"
        tracks={tracks}
        selected={spec.targets}
        excluded={spec.listen?.sources}
        onChange={(targets) => onChange({ ...spec, targets })}
      />

      {def?.needsListen && (
        <>
          <TargetPicker
            label="Listen"
            tracks={tracks}
            selected={spec.listen?.sources ?? []}
            excluded={spec.targets}
            onChange={(sources) =>
              onChange({
                ...spec,
                listen: { sources, derive: spec.listen?.derive ?? 'midi-onsets' },
              })
            }
          />
          <div style={styles.row}>
            <span style={styles.label}>Trigger</span>
            <select
              style={styles.select}
              value={spec.listen?.derive ?? 'midi-onsets'}
              aria-label="listen derivation"
              onChange={(e) =>
                onChange({
                  ...spec,
                  listen: {
                    sources: spec.listen?.sources ?? [],
                    derive: e.target.value as NonNullable<AnimationSpec['listen']>['derive'],
                  },
                })
              }
            >
              <option value="midi-onsets">source notes</option>
              <option value="ghost-four-floor">ghost grid: every beat</option>
              <option value="ghost-eighths">ghost grid: 8ths</option>
            </select>
          </div>
        </>
      )}

      {showKnob('amount') && (
        <div style={styles.row}>
          <span style={styles.label}>Amount</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={spec.params.amount}
            aria-label="amount"
            style={styles.slider}
            onChange={(e) => patchParams({ amount: Number(e.target.value) })}
          />
          <span style={{ color: palette.textDim, width: 32, textAlign: 'right' }}>
            {Math.round(spec.params.amount * 100)}%
          </span>
        </div>
      )}

      {showKnob('rate') && (
        <div style={styles.row}>
          <span style={styles.label}>Rate</span>
          <select
            style={styles.select}
            value={rateLabel(spec.params.rateQn ?? 1)}
            aria-label="rate"
            onChange={(e) => patchParams({ rateQn: RATE_QN[e.target.value] ?? 1 })}
          >
            {Object.keys(RATE_QN).map((token) => (
              <option key={token} value={token}>
                {token}
              </option>
            ))}
          </select>
        </div>
      )}

      {showKnob('shape') && (
        <div style={styles.row}>
          <span style={styles.label}>Shape</span>
          {SHAPE_OPTIONS.map((shape) => (
            <button
              key={shape}
              type="button"
              style={{ ...styles.chip, ...(spec.params.shape === shape ? styles.chipActive : {}) }}
              onClick={() => patchParams({ shape })}
            >
              {shape}
            </button>
          ))}
        </div>
      )}

      {showKnob('filterKind') && (
        <div style={styles.row}>
          <span style={styles.label}>Filter</span>
          {(['hp', 'lp'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              style={{ ...styles.chip, ...(spec.params.filter === kind ? styles.chipActive : {}) }}
              onClick={() => patchParams({ filter: kind })}
            >
              {kind === 'hp' ? 'high-pass ↑' : 'low-pass ↓'}
            </button>
          ))}
        </div>
      )}

      {showKnob('resonance') && (
        <div style={styles.row}>
          <span style={styles.label}>Reso</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={spec.params.resonance01 ?? 0.35}
            aria-label="resonance"
            style={styles.slider}
            onChange={(e) => patchParams({ resonance01: Number(e.target.value) })}
          />
        </div>
      )}

      {showKnob('depthOct') && (
        <div style={styles.row}>
          <span style={styles.label}>Depth</span>
          <input
            type="range"
            min={0}
            max={8}
            step={0.5}
            value={spec.params.depthOct ?? 3}
            aria-label="filter depth (octaves)"
            style={styles.slider}
            onChange={(e) => patchParams({ depthOct: Number(e.target.value) })}
          />
          <span style={{ color: palette.textDim }}>{spec.params.depthOct ?? 3} oct</span>
        </div>
      )}

      {showKnob('lengthBars') && (
        <div style={styles.row}>
          <span style={styles.label}>Length</span>
          {LENGTH_BARS_OPTIONS.map((bars) => (
            <button
              key={bars}
              type="button"
              style={{
                ...styles.chip,
                ...((spec.params.lengthBars ?? 4) === bars ? styles.chipActive : {}),
              }}
              onClick={() => patchParams({ lengthBars: bars })}
            >
              {bars} bar{bars === 1 ? '' : 's'}
            </button>
          ))}
        </div>
      )}

      {showKnob('phaseSpread') && (
        <div style={styles.row}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: palette.textDim, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={spec.params.phaseSpread ?? false}
              onChange={(e) => patchParams({ phaseSpread: e.target.checked })}
            />
            spread phase across targets
          </label>
        </div>
      )}

      {def?.presets && (
        <div style={styles.row}>
          <span style={styles.label}>Preset</span>
          {def.presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              style={{
                ...styles.chip,
                ...(spec.params.presetId === preset.params.presetId ||
                (preset.params.rateQn !== undefined && spec.params.rateQn === preset.params.rateQn)
                  ? styles.chipActive
                  : {}),
              }}
              onClick={() => patchParams(preset.params as Partial<AnimationSpec['params']>)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
