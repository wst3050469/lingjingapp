import type { OpenSpaceProfile, ScriptLanguage } from './types.js';
import type { OpenSpaceBridge } from './bridge.js';
import type { IEventBus, EventTopic } from '../event-bus/types.js';
import { logger } from '../../utils/logger.js';

export interface IFileSystem {
  readdir(path: string): Promise<string[]>;
  readFile(path: string, encoding: string): Promise<string>;
  writeFile(path: string, data: string, encoding: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  stat(path: string): Promise<{ isDirectory(): boolean }>;
}

interface PresetProfileConfig {
  name: string;
  modules: string[];
  metadata: Record<string, string>;
  sceneContent: string;
}

const PRESET_CONFIGS: PresetProfileConfig[] = [
  {
    name: 'solar_system',
    modules: ['SolarSystem', 'Sun', 'Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'],
    metadata: { description: 'Full solar system visualization', category: 'default' },
    sceneContent: '-- Solar System Profile\nopenspace.setPropertyValue("Modules.SolarSystem.Enabled", true)\nopenspace.setPropertyValue("NavigationHandler.Target", "Earth")\nopenspace.setPropertyValue("NavigationHandler.Distance", 2e7)',
  },
  {
    name: 'earth_observation',
    modules: ['Earth', 'EarthAtmosphere', 'EarthClouds', 'EarthNightLights'],
    metadata: { description: 'Earth close-up observation with atmosphere', category: 'earth' },
    sceneContent: '-- Earth Observation Profile\nopenspace.setPropertyValue("Modules.Earth.Enabled", true)\nopenspace.setPropertyValue("Modules.EarthAtmosphere.Enabled", true)\nopenspace.setPropertyValue("NavigationHandler.Target", "Earth")\nopenspace.setPropertyValue("NavigationHandler.Distance", 6371)',
  },
  {
    name: 'deep_space',
    modules: ['MilkyWay', 'GalaxyClusters', 'SloanDigitalSkySurvey'],
    metadata: { description: 'Deep space and galaxy scale visualization', category: 'cosmology' },
    sceneContent: '-- Deep Space Profile\nopenspace.setPropertyValue("Modules.MilkyWay.Enabled", true)\nopenspace.setPropertyValue("NavigationHandler.Target", "MilkyWay")\nopenspace.setPropertyValue("NavigationHandler.Distance", 1e10)',
  },
];

export class OpenSpaceProfileManager {
  private fs: IFileSystem | null;
  private bridge: OpenSpaceBridge | null;
  private eventBus: IEventBus | null;
  private profileCache = new Map<string, OpenSpaceProfile>();
  private currentProfile: string | null = null;

  constructor(fs?: IFileSystem, bridge?: OpenSpaceBridge, eventBus?: IEventBus) {
    this.fs = fs ?? null;
    this.bridge = bridge ?? null;
    this.eventBus = eventBus ?? null;
  }

  get presetProfiles(): OpenSpaceProfile[] {
    return PRESET_CONFIGS.map((cfg) => ({
      name: cfg.name,
      path: `presets://${cfg.name}`,
      modules: cfg.modules,
      metadata: cfg.metadata,
    }));
  }

  async listProfiles(dataDir: string): Promise<OpenSpaceProfile[]> {
    const profiles: OpenSpaceProfile[] = [...this.presetProfiles];

    if (!this.fs) {
      return profiles;
    }

    const profilesDir = this.joinPath(dataDir, 'profiles');

    try {
      const exists = await this.fs.exists(profilesDir);
      if (!exists) return profiles;

      const entries = await this.fs.readdir(profilesDir);

      for (const entry of entries) {
        const entryPath = this.joinPath(profilesDir, entry);
        try {
          const stat = await this.fs.stat(entryPath);
          if (stat.isDirectory()) {
            const profile = await this.readProfileFromDir(entry, entryPath);
            if (profile) {
              this.profileCache.set(profile.name, profile);
              profiles.push(profile);
            }
          }
        } catch {
          logger.warn(`[ProfileManager] failed to read profile dir: ${entry}`);
        }
      }
    } catch (err) {
      logger.warn(`[ProfileManager] failed to list profiles: ${(err as Error).message}`);
    }

    return profiles;
  }

  async loadProfile(name: string): Promise<OpenSpaceProfile> {
    const cached = this.profileCache.get(name);
    if (cached) return cached;

    const preset = PRESET_CONFIGS.find((p) => p.name === name);
    if (preset) {
      const profile: OpenSpaceProfile = {
        name: preset.name,
        path: `presets://${preset.name}`,
        modules: preset.modules,
        metadata: preset.metadata,
      };
      this.profileCache.set(name, profile);
      return profile;
    }

    if (!this.fs) {
      throw new Error(`Profile "${name}" not found and filesystem not available`);
    }

    const dirs = await this.fs.readdir('.');
    for (const dir of dirs) {
      const profilePath = this.joinPath(dir, 'profiles', name);
      try {
        const exists = await this.fs.exists(profilePath);
        if (exists) {
          const profile = await this.readProfileFromDir(name, profilePath);
          if (profile) {
            this.profileCache.set(name, profile);
            return profile;
          }
        }
      } catch {
        continue;
      }
    }

    throw new Error(`Profile "${name}" not found`);
  }

  async saveProfile(profile: OpenSpaceProfile): Promise<void> {
    if (!this.fs) {
      throw new Error('Filesystem not available');
    }

    const profileDir = this.joinPath(profile.path);
    await this.fs.mkdir(profileDir, { recursive: true });

    const sceneFilePath = this.joinPath(profileDir, `${profile.name}.scene`);
    const sceneContent = this.generateSceneContent(profile);
    await this.fs.writeFile(sceneFilePath, sceneContent, 'utf-8');

    const metaFilePath = this.joinPath(profileDir, 'meta.json');
    const metaContent = JSON.stringify({
      name: profile.name,
      modules: profile.modules,
      metadata: profile.metadata,
    }, null, 2);
    await this.fs.writeFile(metaFilePath, metaContent, 'utf-8');

    this.profileCache.set(profile.name, profile);
    logger.info(`[ProfileManager] saved profile: ${profile.name}`);
  }

  async applyProfile(name: string): Promise<void> {
    const profile = await this.loadProfile(name);

    if (!this.bridge || !this.bridge.isConnected) {
      throw new Error('OpenSpace bridge not connected');
    }

    const preset = PRESET_CONFIGS.find((p) => p.name === name);
    const script = preset ? preset.sceneContent : this.generateSceneContent(profile);

    const result = await this.bridge.sendScript({
      script,
      language: 'lua' as ScriptLanguage,
      timeout: 15000,
    });

    if (!result.success) {
      throw new Error(`Failed to apply profile: ${result.error ?? 'unknown error'}`);
    }

    this.currentProfile = name;

    if (this.eventBus) {
      this.eventBus.publish('openspace:profile_loaded' as EventTopic, {
        name,
        modules: profile.modules,
        timestamp: Date.now(),
      }, 'openspace-profile-manager');
    }

    logger.info(`[ProfileManager] applied profile: ${name}`);
  }

  async getAvailableModules(dataDir: string): Promise<string[]> {
    const modules = new Set<string>();

    for (const preset of PRESET_CONFIGS) {
      for (const mod of preset.modules) {
        modules.add(mod);
      }
    }

    if (this.fs) {
      const modulesDir = this.joinPath(dataDir, 'modules');
      try {
        const exists = await this.fs.exists(modulesDir);
        if (exists) {
          const entries = await this.fs.readdir(modulesDir);
          for (const entry of entries) {
            modules.add(entry);
          }
        }
      } catch {
        logger.warn(`[ProfileManager] failed to scan modules dir`);
      }
    }

    return [...modules].sort();
  }

  async notifyReload(): Promise<void> {
    if (!this.bridge || !this.bridge.isConnected) return;
    if (!this.currentProfile) return;

    try {
      await this.applyProfile(this.currentProfile);
    } catch (err) {
      logger.warn(`[ProfileManager] reload failed: ${(err as Error).message}`);
    }
  }

  getCurrentProfile(): string | null {
    return this.currentProfile;
  }

  setBridge(bridge: OpenSpaceBridge): void {
    this.bridge = bridge;
  }

  setFileSystem(fs: IFileSystem): void {
    this.fs = fs;
  }

  async deleteProfile(name: string): Promise<void> {
    this.profileCache.delete(name);
    if (this.currentProfile === name) {
      this.currentProfile = null;
    }
    logger.info(`[ProfileManager] deleted profile: ${name}`);
  }

  private async readProfileFromDir(name: string, dirPath: string): Promise<OpenSpaceProfile | null> {
    if (!this.fs) return null;

    try {
      const metaPath = this.joinPath(dirPath, 'meta.json');
      const metaExists = await this.fs.exists(metaPath);

      if (metaExists) {
        const metaRaw = await this.fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(metaRaw) as { name?: string; modules?: string[]; metadata?: Record<string, string> };
        return {
          name: meta.name ?? name,
          path: dirPath,
          modules: meta.modules ?? [],
          metadata: meta.metadata ?? {},
        };
      }

      return {
        name,
        path: dirPath,
        modules: [],
        metadata: {},
      };
    } catch (err) {
      logger.warn(`[ProfileManager] failed to read profile meta: ${(err as Error).message}`);
      return null;
    }
  }

  private generateSceneContent(profile: OpenSpaceProfile): string {
    const lines: string[] = [`-- Profile: ${profile.name}`];

    for (const mod of profile.modules) {
      lines.push(`openspace.setPropertyValue("Modules.${mod}.Enabled", true)`);
    }

    for (const [key, value] of Object.entries(profile.metadata)) {
      if (key !== 'description' && key !== 'category') {
        lines.push(`openspace.setPropertyValue("${key}", ${this.formatLuaValue(value)})`);
      }
    }

    return lines.join('\n');
  }

  private formatLuaValue(value: string): string {
    if (/^-?\d+(\.\d+)?$/.test(value)) return value;
    if (value === 'true' || value === 'false') return value;
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  private joinPath(...segments: string[]): string {
    return segments.join('/').replace(/\/+/g, '/');
  }
}
