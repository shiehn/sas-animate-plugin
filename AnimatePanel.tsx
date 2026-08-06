/**
 * AnimatePanel — the Animation control panel.
 *
 * A card list over the host's capability-gated animate surface: each card is
 * one animation (type + target tracks + knobs + optional listen sources).
 * New cards start as LOCAL DRAFTS until they have at least one target (the
 * host rejects targetless specs); once targeted, every gesture upserts the
 * full spec via host.setAnimation with a 150 ms debounce (the usePanelBus
 * slider discipline) and optimistic local state reconciled from the
 * returned AnimateState.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AnimateState,
  AnimationInfo,
  AnimationSpec,
  PluginUIProps,
  SceneTrackSummary,
} from '@signalsandsorcery/plugin-sdk';
import {
  ANIMATION_DEFS,
  ANIMATION_DEF_BY_TYPE,
  FAMILY_LABELS,
  FAMILY_ORDER,
  type AnimationTypeDef,
} from './src/animation-defs';
import { AnimationCard } from './src/ui/AnimationCard';
import { styles } from './src/ui/styles';

const PUSH_DEBOUNCE_MS = 150;

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `anim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function draftSpecFor(def: AnimationTypeDef): AnimationSpec {
  const { amount, ...rest } = { amount: 0.7, ...def.defaults };
  return {
    id: newId(),
    type: def.type as AnimationSpec['type'],
    enabled: true,
    targets: [],
    params: { amount: Number(amount), ...(rest as Partial<AnimationSpec['params']>) },
    ...(def.needsListen ? { listen: { sources: [], derive: 'midi-onsets' as const } } : {}),
  };
}

/** A draft is pushable once it has targets — and, for listen types deriving
 *  from source notes, at least one source. */
function isPushable(spec: AnimationSpec): boolean {
  if (spec.targets.length === 0) return false;
  if (spec.listen && spec.listen.derive === 'midi-onsets' && spec.listen.sources.length === 0) {
    return false;
  }
  return true;
}

export function AnimatePanel(props: PluginUIProps): React.ReactElement {
  const { host, activeSceneId } = props;

  const supported = typeof host.setAnimation === 'function';
  const [state, setState] = useState<AnimateState | null>(null);
  const [tracks, setTracks] = useState<SceneTrackSummary[]>([]);
  const [drafts, setDrafts] = useState<AnimationSpec[]>([]);
  /** Optimistic per-animation overrides, cleared as host state confirms. */
  const [pending, setPending] = useState<Record<string, AnimationSpec>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const reload = useCallback(async (): Promise<void> => {
    if (!activeSceneId || !supported) return;
    try {
      const [nextState, sceneTracks] = await Promise.all([
        host.getAnimateState!(activeSceneId),
        host.listSceneTracks ? host.listSceneTracks() : Promise.resolve([]),
      ]);
      setState(nextState);
      setTracks(sceneTracks);
    } catch (err) {
      console.warn('[AnimatePanel] reload failed:', err);
    }
  }, [host, activeSceneId, supported]);

  useEffect(() => {
    setState(null);
    setDrafts([]);
    setPending({});
    setErrors({});
    void reload();
  }, [reload]);

  // Agent parity: re-read after any agent mutation so dsl_animate_* changes
  // appear without reopening the panel.
  useEffect(() => {
    if (!supported || typeof host.onAfterAgentMutation !== 'function') return;
    const unsubscribe = host.onAfterAgentMutation(() => void reload());
    return unsubscribe;
  }, [host, supported, reload]);

  const pushSpec = useCallback(
    (spec: AnimationSpec): void => {
      if (!activeSceneId) return;
      setPending((prev) => ({ ...prev, [spec.id]: spec }));
      if (timers.current[spec.id]) clearTimeout(timers.current[spec.id]);
      timers.current[spec.id] = setTimeout(() => {
        delete timers.current[spec.id];
        void (async () => {
          try {
            const next = await host.setAnimation!(activeSceneId, spec);
            setState(next);
            setDrafts((prev) => prev.filter((d) => d.id !== spec.id));
            setPending((prev) => {
              const { [spec.id]: _confirmed, ...rest } = prev;
              return rest;
            });
            setErrors((prev) => {
              const { [spec.id]: _cleared, ...rest } = prev;
              return rest;
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setErrors((prev) => ({ ...prev, [spec.id]: message }));
          }
        })();
      }, PUSH_DEBOUNCE_MS);
    },
    [host, activeSceneId]
  );

  const handleChange = useCallback(
    (spec: AnimationSpec): void => {
      if (isPushable(spec)) {
        pushSpec(spec);
      } else {
        // Not yet valid for the host — keep it as a local draft.
        setDrafts((prev) => {
          const others = prev.filter((d) => d.id !== spec.id);
          return [...others, spec];
        });
        setPending((prev) => ({ ...prev, [spec.id]: spec }));
      }
    },
    [pushSpec]
  );

  const handleRemove = useCallback(
    (animationId: string): void => {
      if (timers.current[animationId]) clearTimeout(timers.current[animationId]);
      setDrafts((prev) => prev.filter((d) => d.id !== animationId));
      setPending((prev) => {
        const { [animationId]: _removed, ...rest } = prev;
        return rest;
      });
      setErrors((prev) => {
        const { [animationId]: _removed, ...rest } = prev;
        return rest;
      });
      const persisted = state?.animations.some((a) => a.spec.id === animationId);
      if (persisted && activeSceneId) {
        void host
          .removeAnimation!(activeSceneId, animationId)
          .then(setState)
          .catch((err) => console.warn('[AnimatePanel] remove failed:', err));
      }
    },
    [host, activeSceneId, state]
  );

  const addAnimation = useCallback((def: AnimationTypeDef): void => {
    setMenuOpen(false);
    setDrafts((prev) => [...prev, draftSpecFor(def)]);
  }, []);

  /** Render list: persisted (with optimistic overrides) + local drafts. */
  const cards = useMemo((): Array<{ spec: AnimationSpec; info?: AnimationInfo }> => {
    const persisted = (state?.animations ?? []).map((info) => ({
      spec: pending[info.spec.id] ?? info.spec,
      info,
    }));
    const persistedIds = new Set(persisted.map((c) => c.spec.id));
    const draftCards = drafts
      .filter((d) => !persistedIds.has(d.id))
      .map((d) => ({ spec: pending[d.id] ?? d }));
    return [...persisted, ...draftCards];
  }, [state, drafts, pending]);

  if (!activeSceneId) {
    return (
      <div style={styles.panel} data-testid="animate-panel">
        <div style={styles.emptyState}>Select a scene to add animations.</div>
      </div>
    );
  }
  if (!supported) {
    return (
      <div style={styles.panel} data-testid="animate-panel">
        <div style={styles.emptyState}>This host version does not support the animate surface.</div>
      </div>
    );
  }

  return (
    <div style={styles.panel} data-testid="animate-panel">
      {cards.length === 0 && !menuOpen && (
        <div style={styles.emptyState}>
          No animations yet — add a pump, autopan, gate, fade, filter sweep, or duck.
        </div>
      )}

      {cards.map(({ spec, info }) => (
        <AnimationCard
          key={spec.id}
          spec={spec}
          tracks={tracks}
          onsetCount={info?.onsetCount}
          error={errors[spec.id]}
          onChange={handleChange}
          onRemove={handleRemove}
        />
      ))}

      {menuOpen ? (
        <div style={styles.menu} data-testid="animate-add-menu">
          {FAMILY_ORDER.map((family) => {
            const defs = ANIMATION_DEFS.filter((d) => d.family === family);
            if (defs.length === 0) return null;
            return (
              <div key={family}>
                <div style={styles.menuFamily}>{FAMILY_LABELS[family]}</div>
                {defs.map((def) => (
                  <button
                    key={def.type}
                    type="button"
                    style={styles.menuItem}
                    onClick={() => addAnimation(def)}
                  >
                    <strong>{def.label}</strong>
                    <span style={{ opacity: 0.5 }}> — {def.blurb}</span>
                  </button>
                ))}
              </div>
            );
          })}
          <button type="button" style={{ ...styles.menuItem, opacity: 0.6 }} onClick={() => setMenuOpen(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" style={styles.addButton} onClick={() => setMenuOpen(true)}>
          + Add animation
        </button>
      )}
    </div>
  );
}

export { ANIMATION_DEF_BY_TYPE };
