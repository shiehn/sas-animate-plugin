/**
 * TargetPicker — multi-select track chips over host.listSceneTracks().
 * Selection stores DB ids (Track Identity rule: names are display-only).
 */

import React from 'react';
import type { SceneTrackSummary } from '@signalsandsorcery/plugin-sdk';
import { palette, styles } from './styles';

export interface TargetPickerProps {
  label: string;
  tracks: SceneTrackSummary[];
  selected: string[];
  /** Track dbIds to grey out (e.g. an animation's own targets in the source picker). */
  excluded?: string[];
  onChange: (dbIds: string[]) => void;
}

export function TargetPicker({ label, tracks, selected, excluded, onChange }: TargetPickerProps): React.ReactElement {
  const toggle = (dbId: string): void => {
    onChange(
      selected.includes(dbId) ? selected.filter((id) => id !== dbId) : [...selected, dbId]
    );
  };

  return (
    <div style={styles.row} data-testid={`picker-${label.toLowerCase()}`}>
      <span style={styles.label}>{label}</span>
      {tracks.length === 0 ? (
        <span style={{ color: palette.textFaint }}>no tracks in this scene yet</span>
      ) : (
        tracks.map((track) => {
          const isSelected = selected.includes(track.dbId);
          const isExcluded = !!excluded?.includes(track.dbId);
          return (
            <button
              key={track.dbId}
              type="button"
              disabled={isExcluded}
              onClick={() => toggle(track.dbId)}
              style={{
                ...styles.chip,
                ...(isSelected ? styles.chipActive : {}),
                ...(isExcluded ? { opacity: 0.3, cursor: 'not-allowed' } : {}),
              }}
              title={track.role ? `${track.name} (${track.role})` : track.name}
            >
              {track.name || track.dbId.slice(0, 6)}
            </button>
          );
        })
      )}
    </div>
  );
}
