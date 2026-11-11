/**
 * Client for a self-hosted Postiz instance's public API.
 * Base URL is the instance's public API root, e.g. https://postiz.example.com/api/public/v1
 * (the exact prefix depends on your deployment; see docs/publishing.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const PostizIntegration = z.object({
  id: z.string(),
  name: z.string(),
  identifier: z.string(),
  disabled: z.boolean().optional(),
  profile: z.string().optional(),
});
export type PostizIntegration = z.infer<typeof PostizIntegration>;

export const PostizMedia = z.object({ id: z.string(), path: z.string() });
export type PostizMedia = z.infer<typeof PostizMedia>;

export class PostizError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'PostizError';
  }
}

export type FetchLike = typeof fetch;

export class PostizClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private async request<S extends z.ZodType>(
    method: string,
    route: string,
    schema: S,
    body?: BodyInit,
    json = false,
  ): Promise<z.infer<S>> {
    const res = await this.fetchImpl(`${this.baseUrl}${route}`, {
      method,
      headers: { Authorization: this.apiKey, ...(json ? { 'Content-Type': 'application/json' } : {}) },
      body,
    });
    const text = await res.text();
    if (!res.ok)
      throw new PostizError(`Postiz ${method} ${route} failed with ${res.status}`, res.status, text.slice(0, 2000));
    const data: unknown = text ? JSON.parse(text) : {};
    return schema.parse(data);
  }

  listIntegrations(): Promise<PostizIntegration[]> {
    return this.request('GET', '/integrations', z.array(PostizIntegration));
  }

  async uploadFile(file: string): Promise<PostizMedia> {
    const form = new FormData();
    const blob = new Blob([fs.readFileSync(file)], {
      type: file.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream',
    });
    form.append('file', blob, path.basename(file));
    return this.request('POST', '/upload', PostizMedia.passthrough(), form);
  }

  createPost(payload: unknown): Promise<unknown> {
    return this.request('POST', '/posts', z.unknown(), JSON.stringify(payload), true);
  }
}
