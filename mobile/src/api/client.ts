import type { paths } from '@dating/api-contract';

type ReadyResponse = paths['/api/health/ready']['get']['responses'][200]['content']['application/json'];

export async function getReadiness(baseUrl: string, signal?: AbortSignal): Promise<ReadyResponse> {
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid API URL');
  if (!__DEV__ && url.protocol !== 'https:') throw new Error('HTTPS required');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel);
  if (signal?.aborted) cancel();
  const timeout = setTimeout(cancel, 5000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/health/ready`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('API unavailable');
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null || !('status' in body) || body.status !== 'ready') throw new Error('Invalid readiness response');
    return { status: body.status };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
