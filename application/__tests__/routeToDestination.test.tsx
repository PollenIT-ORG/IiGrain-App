import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  useRouteToDestination,
  type UseRouteToDestination,
} from '../src/maps/hooks/useRouteToDestination';
import { fetchDrivingRoute } from '../src/maps/services/directionsService';
import type { MapRoute } from '../src/maps/types';

jest.mock('../src/maps/services/directionsService', () => ({
  fetchDrivingRoute: jest.fn(),
}));

const mockedFetch = fetchDrivingRoute as jest.MockedFunction<typeof fetchDrivingRoute>;

const ROUTE: MapRoute = {
  path: [
    { latitude: 28.61, longitude: 77.2 },
    { latitude: 28.63, longitude: 77.22 },
    { latitude: 28.65, longitude: 77.25 },
  ],
  distanceMeters: 5200,
  durationSeconds: 900,
};

let latest: UseRouteToDestination;

const Harness: React.FC<{ lat: number }> = ({ lat }) => {
  latest = useRouteToDestination(
    { latitude: lat, longitude: 77.2 },
    { latitude: 28.65, longitude: 77.25 },
  );
  return null;
};

describe('useRouteToDestination', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedFetch.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('1 - a re-render while the request is in flight does not cancel the route', async () => {
    let resolveRoute!: (value: MapRoute | null) => void;
    mockedFetch.mockReturnValueOnce(
      new Promise(resolve => {
        resolveRoute = resolve;
      }),
    );

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Harness lat={28.61} />);
    });

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(latest.isFallback).toBe(true);

    act(() => {
      tree.update(<Harness lat={28.61} />);
    });

    await act(async () => {
      resolveRoute(ROUTE);
    });

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(latest.isFallback).toBe(false);
    expect(latest.path).toEqual(ROUTE.path);

    act(() => {
      tree.unmount();
    });
  });

  test('2 - a failed first attempt is retried instead of sticking to the straight line', async () => {
    mockedFetch.mockResolvedValueOnce(null).mockResolvedValueOnce(ROUTE);

    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<Harness lat={28.61} />);
    });

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(latest.isFallback).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(8_100);
    });

    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(latest.isFallback).toBe(false);

    act(() => {
      tree.unmount();
    });
  });
});
