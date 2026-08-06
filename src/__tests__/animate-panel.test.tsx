/**
 * AnimatePanel — draft lifecycle + host push contract:
 *   - empty/no-scene/unsupported states,
 *   - Add menu creates a LOCAL draft (no host call until targeted),
 *   - targeting a draft pushes the full spec after the debounce,
 *   - validation failures surface on the card, spec stays editable,
 *   - remove of a persisted animation calls host.removeAnimation.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type {
  AnimateState,
  PluginHost,
  PluginUIProps,
  SceneTrackSummary,
} from '@signalsandsorcery/plugin-sdk';
import { AnimatePanel } from '../../AnimatePanel';

const TRACKS: SceneTrackSummary[] = [
  { dbId: 't1', name: 'Warm Pad', role: 'pads', hasMidi: true },
  { dbId: 't2', name: 'Kick', role: 'kicks', hasMidi: true },
];

function emptyState(): AnimateState {
  return { animations: [] };
}

interface HostStubs {
  host: PluginHost;
  getAnimateState: jest.Mock;
  setAnimation: jest.Mock;
  removeAnimation: jest.Mock;
}

function makeHost(initial: AnimateState = emptyState()): HostStubs {
  const getAnimateState = jest.fn().mockResolvedValue(initial);
  const setAnimation = jest.fn().mockImplementation(async (_sceneId: string, spec: unknown) => ({
    animations: [
      {
        spec,
        targets: (spec as { targets: string[] }).targets.map((dbId) => ({
          dbId,
          name: TRACKS.find((t) => t.dbId === dbId)?.name ?? dbId,
          missing: false,
        })),
        sources: [],
      },
    ],
  }));
  const removeAnimation = jest.fn().mockResolvedValue(emptyState());
  const host = {
    getAnimateState,
    setAnimation,
    removeAnimation,
    refreshAnimations: jest.fn(),
    listSceneTracks: jest.fn().mockResolvedValue(TRACKS),
  } as unknown as PluginHost;
  return { host, getAnimateState, setAnimation, removeAnimation };
}

function renderPanel(host: PluginHost, activeSceneId: string | null = 'scene-1'): void {
  const props = {
    host,
    activeSceneId,
    isAuthenticated: true,
    isConnected: true,
  } as unknown as PluginUIProps;
  render(<AnimatePanel {...props} />);
}

describe('AnimatePanel', () => {
  it('prompts for a scene when none is active', () => {
    const { host } = makeHost();
    renderPanel(host, null);
    expect(screen.getByText(/Select a scene/)).toBeInTheDocument();
  });

  it('degrades legibly on hosts without the animate surface', () => {
    renderPanel({ listSceneTracks: jest.fn().mockResolvedValue([]) } as unknown as PluginHost);
    expect(screen.getByText(/does not support the animate surface/)).toBeInTheDocument();
  });

  it('shows the empty state and the grouped add menu', async () => {
    const { host, getAnimateState } = makeHost();
    renderPanel(host);
    await waitFor(() => expect(getAnimateState).toHaveBeenCalled());
    expect(screen.getByText(/No animations yet/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('+ Add animation'));
    expect(screen.getByTestId('animate-add-menu')).toBeInTheDocument();
    expect(screen.getByText('Cyclic')).toBeInTheDocument();
    expect(screen.getByText('Lab')).toBeInTheDocument();
    expect(screen.getByText('Pumper')).toBeInTheDocument();
  });

  it('adding creates a local draft; targeting it pushes the full spec', async () => {
    jest.useFakeTimers();
    try {
      const { host, getAnimateState, setAnimation } = makeHost();
      renderPanel(host);
      await act(async () => {
        await Promise.resolve();
      });
      expect(getAnimateState).toHaveBeenCalled();

      fireEvent.click(screen.getByText('+ Add animation'));
      fireEvent.click(screen.getByText('Autopan'));

      // Draft card exists, but nothing was pushed (no targets yet).
      expect(screen.getByTestId('animation-card-autopan')).toBeInTheDocument();
      expect(setAnimation).not.toHaveBeenCalled();

      // Pick a target → debounced push of the complete spec.
      fireEvent.click(screen.getByText('Warm Pad'));
      await act(async () => {
        jest.advanceTimersByTime(200);
        await Promise.resolve();
      });
      expect(setAnimation).toHaveBeenCalledTimes(1);
      const [sceneId, pushed] = setAnimation.mock.calls[0] as [string, { type: string; targets: string[] }];
      expect(sceneId).toBe('scene-1');
      expect(pushed.type).toBe('autopan');
      expect(pushed.targets).toEqual(['t1']);
    } finally {
      jest.useRealTimers();
    }
  });

  it('surfaces a host validation error on the card', async () => {
    jest.useFakeTimers();
    try {
      const { host, setAnimation } = makeHost();
      setAnimation.mockRejectedValue(new Error("'autopan' conflicts with the enabled 'trance-gate'"));
      renderPanel(host);
      await act(async () => {
        await Promise.resolve();
      });

      fireEvent.click(screen.getByText('+ Add animation'));
      fireEvent.click(screen.getByText('Autopan'));
      fireEvent.click(screen.getByText('Warm Pad'));
      await act(async () => {
        jest.advanceTimersByTime(200);
        await Promise.resolve();
      });

      expect(screen.getByText(/conflicts with the enabled 'trance-gate'/)).toBeInTheDocument();
      // Card is still there, editable.
      expect(screen.getByTestId('animation-card-autopan')).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('removing a persisted animation calls host.removeAnimation', async () => {
    const persisted: AnimateState = {
      animations: [
        {
          spec: {
            id: 'a1',
            type: 'pumper',
            enabled: true,
            targets: ['t1'],
            params: { amount: 0.6, rateQn: 1 },
          },
          targets: [{ dbId: 't1', name: 'Warm Pad', missing: false }],
          sources: [],
          onsetCount: 16,
        },
      ],
    };
    const { host, removeAnimation } = makeHost(persisted);
    renderPanel(host);
    await waitFor(() => expect(screen.getByTestId('animation-card-pumper')).toBeInTheDocument());
    expect(screen.getByText(/16 triggers/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('remove Pumper'));
    await waitFor(() => expect(removeAnimation).toHaveBeenCalledWith('scene-1', 'a1'));
  });
});
