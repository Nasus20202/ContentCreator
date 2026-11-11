/**
 * Minimal client for Buffer's public GraphQL API (https://developers.buffer.com).
 * Auth: personal API key from https://publish.buffer.com/settings/api (env BUFFER_API_KEY).
 * Media is not uploaded to Buffer; posts reference a public URL (see media-host.ts).
 */
import { z } from 'zod';

export const BUFFER_ENDPOINT = 'https://api.buffer.com';

export class BufferError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'BufferError';
  }
}

export const BufferChannel = z.object({
  id: z.string(),
  name: z.string(),
  service: z.string(),
  isDisconnected: z.boolean().optional(),
});
export type BufferChannel = z.infer<typeof BufferChannel>;

const CreatePostResult = z.union([
  z.object({ post: z.object({ id: z.string(), dueAt: z.string().nullish(), status: z.string().nullish() }) }),
  z.object({ message: z.string() }),
]);

export type FetchLike = typeof fetch;

export class BufferClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
    readonly endpoint: string = BUFFER_ENDPOINT,
  ) {}

  async gql(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
    const res = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    if (!res.ok) throw new BufferError(`Buffer API HTTP ${res.status}`, res.status, text);
    const json = JSON.parse(text) as { data?: unknown; errors?: { message: string }[] };
    if (json.errors?.length) throw new BufferError(json.errors.map((e) => e.message).join('; '), res.status, text);
    return json.data;
  }

  async organizations(): Promise<{ id: string; name: string }[]> {
    const data = (await this.gql('query { account { organizations { id name } } }')) as {
      account: { organizations: { id: string; name: string }[] };
    };
    return data.account.organizations;
  }

  async channels(organizationId: string): Promise<BufferChannel[]> {
    const data = (await this.gql(
      'query($org: OrganizationId!) { channels(input: { organizationId: $org }) { id name service isDisconnected } }',
      { org: organizationId },
    )) as { channels: unknown[] };
    return data.channels.map((c) => BufferChannel.parse(c));
  }

  /** Returns the Buffer post id; throws BufferError with Buffer's message on a MutationError. */
  async createPost(input: Record<string, unknown>): Promise<{ id: string; dueAt?: string | null }> {
    const data = (await this.gql(
      `mutation($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess { post { id dueAt status } }
          ... on MutationError { message }
        }
      }`,
      { input },
    )) as { createPost: unknown };
    const result = CreatePostResult.parse(data.createPost);
    if ('message' in result) throw new BufferError(result.message);
    return result.post;
  }
}
