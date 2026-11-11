import fs from 'node:fs';
import { paths } from './paths';
import { PipelineError, readJson } from './io';
import { ChannelConfig, type Location } from './schemas';

export function loadConfig(file = paths.channelConfig): ChannelConfig {
  if (!fs.existsSync(file)) throw new PipelineError('channel.config.json not found at repo root');
  return readJson(file, ChannelConfig);
}

export function resolveLocation(config: ChannelConfig, id?: string): Location {
  const wanted = id ?? config.defaultLocation;
  const loc = config.locations.find((l) => l.id === wanted);
  if (!loc) {
    throw new PipelineError(`Unknown location "${wanted}"`, `Known: ${config.locations.map((l) => l.id).join(', ')}`);
  }
  return loc;
}

/** Secrets come from the environment (.env), never from committed config. */
export function postizEnv(): { baseUrl: string; apiKey: string } | undefined {
  const baseUrl = process.env.POSTIZ_BASE_URL?.replace(/\/+$/, '');
  const apiKey = process.env.POSTIZ_API_KEY;
  if (!baseUrl || !apiKey) return undefined;
  return { baseUrl, apiKey };
}
