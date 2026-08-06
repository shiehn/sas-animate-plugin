/**
 * AnimationCard — rendering + gesture contract: every control change calls
 * onChange with the FULL updated spec (the panel owns debounce/push).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AnimationSpec, SceneTrackSummary } from '@signalsandsorcery/plugin-sdk';
import { AnimationCard } from '../ui/AnimationCard';

const TRACKS: SceneTrackSummary[] = [
  { dbId: 't1', name: 'Warm Pad', role: 'pads', hasMidi: true },
  { dbId: 't2', name: 'Kick', role: 'kicks', hasMidi: true },
];

function spec(overrides: Partial<AnimationSpec> = {}): AnimationSpec {
  return {
    id: 'a1',
    type: 'trance-gate',
    enabled: true,
    targets: ['t1'],
    params: { amount: 0.8, rateQn: 0.25 },
    ...overrides,
  };
}

describe('AnimationCard', () => {
  it('renders the def label, targets, and knobs for the type', () => {
    render(
      <AnimationCard spec={spec()} tracks={TRACKS} onChange={jest.fn()} onRemove={jest.fn()} />
    );
    expect(screen.getByText('Trance Gate')).toBeInTheDocument();
    expect(screen.getByText('Warm Pad')).toBeInTheDocument();
    expect(screen.getByLabelText('amount')).toBeInTheDocument();
    expect(screen.getByLabelText('rate')).toBeInTheDocument();
  });

  it('amount slider emits the full spec with the new amount', () => {
    const onChange = jest.fn();
    render(<AnimationCard spec={spec()} tracks={TRACKS} onChange={onChange} onRemove={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('amount'), { target: { value: '0.5' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1', params: expect.objectContaining({ amount: 0.5, rateQn: 0.25 }) })
    );
  });

  it('toggling a target chip adds/removes its dbId', () => {
    const onChange = jest.fn();
    render(<AnimationCard spec={spec()} tracks={TRACKS} onChange={onChange} onRemove={jest.fn()} />);
    fireEvent.click(screen.getByText('Kick'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ targets: ['t1', 't2'] }));
  });

  it('enable checkbox and remove button work', () => {
    const onChange = jest.fn();
    const onRemove = jest.fn();
    render(<AnimationCard spec={spec()} tracks={TRACKS} onChange={onChange} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText('Trance Gate enabled'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    fireEvent.click(screen.getByLabelText('remove Trance Gate'));
    expect(onRemove).toHaveBeenCalledWith('a1');
  });

  it('duck: shows listen picker, excludes targets from sources and vice versa', () => {
    const onChange = jest.fn();
    render(
      <AnimationCard
        spec={spec({
          type: 'duck',
          params: { amount: 0.6 },
          targets: ['t1'],
          listen: { sources: [], derive: 'midi-onsets' },
        })}
        tracks={TRACKS}
        onChange={onChange}
        onRemove={jest.fn()}
      />
    );
    expect(screen.getByTestId('picker-listen')).toBeInTheDocument();
    // In the LISTEN picker the current target (Warm Pad) is disabled.
    const listenPad = screen
      .getByTestId('picker-listen')
      .querySelector('button[title*="Warm Pad"]') as HTMLButtonElement;
    expect(listenPad.disabled).toBe(true);
    // Selecting Kick as a source emits the listen update.
    const listenKick = screen
      .getByTestId('picker-listen')
      .querySelector('button[title*="Kick"]') as HTMLButtonElement;
    fireEvent.click(listenKick);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ listen: { sources: ['t2'], derive: 'midi-onsets' } })
    );
  });

  it('surfaces a card error inline', () => {
    render(
      <AnimationCard
        spec={spec()}
        tracks={TRACKS}
        error="'trance-gate' conflicts with the enabled 'autopan'"
        onChange={jest.fn()}
        onRemove={jest.fn()}
      />
    );
    expect(screen.getByText(/conflicts with the enabled 'autopan'/)).toBeInTheDocument();
  });
});
