/**
 * @signalsandsorcery/animate — plugin entry.
 *
 * Animation control panel: a control-plane plugin that owns NO tracks.
 * The user builds a list of "animations" — an automation type (pumper,
 * autopan, trance gate, fade, DJ filter sweep, duck, …) + target track(s)
 * + rate/depth/shape params + optional "listen" source track(s) — and the
 * host compiles each one to declarative engine configs (track motion,
 * track ducker, volume curves) that render identically live and offline.
 *
 * All mutation flows through the capability-gated PluginHost animate
 * surface (`setAnimation` / `removeAnimation`); this plugin never touches
 * tracks directly and never owns a panel bus.
 */

import type { ComponentType } from 'react';
import type {
  GeneratorPlugin,
  PluginHost,
  PluginUIProps,
  PluginSettingsSchema,
} from '@signalsandsorcery/plugin-sdk';
import { AnimatePanel } from './AnimatePanel';
import manifest from './plugin.json';

export const ANIMATE_PLUGIN_ID = '@signalsandsorcery/animate';

class AnimatePlugin implements GeneratorPlugin {
  readonly id = ANIMATE_PLUGIN_ID;
  readonly displayName = 'Animate';
  readonly version = '1.0.0';
  readonly description =
    'Animation control panel — musical automations (pump, autopan, gate, fades, filter sweeps, duck) applied to any tracks in the scene';
  readonly generatorType = 'hybrid' as const;
  readonly minHostVersion = '2.64.0';

  private host: PluginHost | null = null;

  async activate(host: PluginHost): Promise<void> {
    this.host = host;
    console.log('[AnimatePlugin] activated');
  }

  async deactivate(): Promise<void> {
    this.host = null;
  }

  getUIComponent(): ComponentType<PluginUIProps> {
    return AnimatePanel;
  }

  getSettingsSchema(): PluginSettingsSchema | null {
    return null;
  }
}

export default AnimatePlugin;
export { AnimatePlugin, AnimatePanel };
export * from './src/animation-defs';
export const animateManifest = manifest;
