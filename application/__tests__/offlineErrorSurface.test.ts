import { AxiosError, AxiosHeaders } from 'axios';
import http from '../src/services/http';
import { setErrorHandler } from '../src/services/errorService';
import { isStateOnline } from '../src/services/sync';

const stubAdapter = (outcome: { status: number | null }): void => {
  http.defaults.adapter = async config => {
    if (outcome.status === null) {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config, {}, undefined);
    }
    const response = {
      data: {},
      status: outcome.status,
      statusText: String(outcome.status),
      headers: new AxiosHeaders(),
      config,
    };
    throw new AxiosError('failed', 'ERR', config, null, response as never);
  };
};

describe('offline errors do not raise the blocking modal', () => {
  let shown: number;

  beforeEach(() => {
    shown = 0;
    setErrorHandler(() => {
      shown += 1;
    });
  });

  afterEach(() => {
    setErrorHandler(null);
  });

  it('stays silent when the request never reached the server', async () => {
    stubAdapter({ status: null });

    await expect(
      http.get('/anything', { skipRetry: true }),
    ).rejects.toBeInstanceOf(AxiosError);

    expect(shown).toBe(0);
  });

  it('still surfaces a server error', async () => {
    stubAdapter({ status: 500 });

    await expect(http.get('/anything', { skipRetry: true })).rejects.toBeDefined();

    expect(shown).toBe(1);
  });

  it('still surfaces a validation error', async () => {
    stubAdapter({ status: 422 });

    await expect(http.get('/anything', { skipRetry: true })).rejects.toBeDefined();

    expect(shown).toBe(1);
  });

  it('respects the silent flag for server errors', async () => {
    stubAdapter({ status: 500 });

    await expect(
      http.get('/anything', { skipRetry: true, silent: true }),
    ).rejects.toBeDefined();

    expect(shown).toBe(0);
  });
});

describe('connectivity mapping drives the banner', () => {
  it('treats an unreachable network as offline', () => {
    expect(isStateOnline({ isConnected: true, isInternetReachable: false } as never)).toBe(
      false,
    );
    expect(isStateOnline({ isConnected: false } as never)).toBe(false);
  });

  it('treats a reachable network as online', () => {
    expect(isStateOnline({ isConnected: true, isInternetReachable: true } as never)).toBe(
      true,
    );
  });
});
