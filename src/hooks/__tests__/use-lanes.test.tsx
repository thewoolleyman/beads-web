import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useLanes } from '@/hooks/use-lanes';
import { DEFAULT_LANES } from '@/lib/lanes';

function stubFetch(impl: () => Promise<unknown>) {
  const fetchMock = vi.fn().mockImplementation(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useLanes', () => {
  it('starts from the default lane order', () => {
    stubFetch(() => jsonResponse({ lanes: ['todo', 'doing'] }));

    const { result } = renderHook(() => useLanes());

    expect(result.current).toEqual(DEFAULT_LANES);
  });

  it('takes the lane order the server configured', async () => {
    const fetchMock = stubFetch(() => jsonResponse({ lanes: ['todo', 'doing', 'done'] }));

    const { result } = renderHook(() => useLanes());

    await waitFor(() => expect(result.current).toEqual(['todo', 'doing', 'done']));
    expect(fetchMock).toHaveBeenCalledWith('/api/lanes', expect.anything());
  });

  it('falls back to the default order when the request fails', async () => {
    stubFetch(() => Promise.reject(new Error('offline')));

    const { result } = renderHook(() => useLanes());

    await waitFor(() => expect(result.current).toEqual(DEFAULT_LANES));
  });

  it('falls back to the default order on an error status', async () => {
    stubFetch(() => jsonResponse({ error: 'boom' }, false));

    const { result } = renderHook(() => useLanes());

    await waitFor(() => expect(result.current).toEqual(DEFAULT_LANES));
  });

  it('ignores a malformed or empty lane list', async () => {
    stubFetch(() => jsonResponse({ lanes: [] }));
    const empty = renderHook(() => useLanes());
    await waitFor(() => expect(empty.result.current).toEqual(DEFAULT_LANES));

    stubFetch(() => jsonResponse({ lanes: 'todo,doing' }));
    const wrongType = renderHook(() => useLanes());
    await waitFor(() => expect(wrongType.result.current).toEqual(DEFAULT_LANES));

    stubFetch(() => jsonResponse({}));
    const missing = renderHook(() => useLanes());
    await waitFor(() => expect(missing.result.current).toEqual(DEFAULT_LANES));
  });

  it('drops blank entries and trims the ones it keeps', async () => {
    stubFetch(() => jsonResponse({ lanes: [' todo ', '', 'doing', '   '] }));

    const { result } = renderHook(() => useLanes());

    await waitFor(() => expect(result.current).toEqual(['todo', 'doing']));
  });
});
