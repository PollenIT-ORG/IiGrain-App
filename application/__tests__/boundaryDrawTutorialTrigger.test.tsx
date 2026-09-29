/**
 * Reproduces the reported bug directly: a user says the first-draw tutorial
 * never appears. `boundaryDrawTutorial.test.tsx` only proves the tutorial
 * component itself works in isolation — it never presses the real "Draw
 * field boundary" button. This test does: it mounts the actual
 * `BoundaryEditorScreen` (not a stand-in), with the real Redux store and a
 * fresh (mocked, empty) AsyncStorage — the exact state a phone that has never
 * drawn a boundary is in — and presses the real button to prove the wiring
 * from tap to tutorial holds end to end.
 *
 * Presence is checked via the coach mark's own accessibility label rather
 * than `findByType(BoundaryDrawTutorial)` — `react-test-renderer` resolves a
 * `React.memo`-wrapped component to more than one fiber shape depending on
 * how it's reached, so type-identity lookups are brittle here; the label only
 * exists in the tree at all while the overlay is actually showing, which is
 * the one fact under test.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TestRenderer, { act } from 'react-test-renderer';
import BoundaryEditorScreen from '../src/screens/farms/BoundaryEditorScreen';
import { store } from '../src/redux/store';
import { markDrawTutorialSeen } from '../src/redux/slices/boundarySlice';

// The screen hydrates a saved boundary over the network on mount
// (`useBoundaryPersistence` → `remoteBoundaryRepository.load`). Real axios
// calls in a test environment hang and reject after the test has finished,
// crashing the whole run — the repository already treats a failed load as
// "no boundary yet", which is exactly the state under test.
jest.mock('../src/services/http', () => ({
  __esModule: true,
  setUnauthorizedHandler: jest.fn(),
  default: {
    get: jest.fn(() => Promise.reject(new Error('network disabled in test'))),
    put: jest.fn(() => Promise.reject(new Error('network disabled in test'))),
    post: jest.fn(() => Promise.reject(new Error('network disabled in test'))),
  },
}));

const params = {
  farmId: 'test-farm',
  fieldId: 'test-field',
  fieldName: 'Test field',
  latitude: 28.6139,
  longitude: 77.209,
};

const TUTORIAL_LABEL = 'How to draw a field boundary';

const isTutorialShowing = (tree: TestRenderer.ReactTestRenderer): boolean =>
  tree.root.findAllByProps({ accessibilityLabel: TUTORIAL_LABEL }).length > 0;

const renderScreen = async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Provider store={store}>
          <SafeAreaProvider
            initialMetrics={{
              frame: { x: 0, y: 0, width: 390, height: 844 },
              insets: { top: 47, left: 0, right: 0, bottom: 34 },
            }}>
            <BoundaryEditorScreen
              route={{ key: 'BoundaryEditor', name: 'BoundaryEditor', params } as never}
              navigation={
                {
                  goBack: jest.fn(),
                  navigate: jest.fn(),
                  setOptions: jest.fn(),
                  addListener: jest.fn(() => () => {}),
                } as never
              }
            />
          </SafeAreaProvider>
        </Provider>
      </GestureHandlerRootView>,
    );
    // Let the rejected `load()` (mocked http, see above) resolve and settle
    // `hydrating`, so no state update lands after the test has moved on.
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
  });
  return tree;
};

describe('first-draw tutorial trigger (real screen, real button)', () => {
  test('1 - a device that has never drawn starts with the tutorial hidden', async () => {
    const tree = await renderScreen();
    expect(isTutorialShowing(tree)).toBe(false);
    act(() => tree.unmount());
  });

  test('2 - pressing "Draw field boundary" opens the tutorial', async () => {
    const tree = await renderScreen();

    const drawButton = tree.root.findByProps({ title: 'Draw field boundary' });
    act(() => drawButton.props.onPress());

    expect(isTutorialShowing(tree)).toBe(true);
    act(() => tree.unmount());
  });

  test('3 - Skip closes it and it does not reopen on the next Draw tap', async () => {
    const tree = await renderScreen();

    act(() => tree.root.findByProps({ title: 'Draw field boundary' }).props.onPress());
    expect(isTutorialShowing(tree)).toBe(true);

    // dismiss() fades the overlay out (real ~200ms) before calling onDismiss.
    await act(async () => {
      tree.root
        .findByProps({ accessibilityLabel: 'Skip the tutorial' })
        .props.onPress();
      await new Promise<void>(resolve => setTimeout(() => resolve(), 260));
    });
    expect(isTutorialShowing(tree)).toBe(false);

    // Back to VIEW mode (Cancel), tap Draw again — same device, second time.
    // It must not come back.
    act(() => tree.root.findByProps({ title: 'Cancel' }).props.onPress());
    act(() => tree.root.findByProps({ title: 'Draw field boundary' }).props.onPress());
    expect(isTutorialShowing(tree)).toBe(false);

    act(() => tree.unmount());
  });

  test('4 - the "How to draw" button reopens it on a device that has already dismissed it', async () => {
    // Same precondition Skip leaves behind — set directly, so this test does
    // not depend on test 3 having already run first.
    store.dispatch(markDrawTutorialSeen());

    const tree = await renderScreen();

    act(() => tree.root.findByProps({ title: 'Draw field boundary' }).props.onPress());
    expect(isTutorialShowing(tree)).toBe(false);
    act(() => tree.root.findByProps({ title: 'Cancel' }).props.onPress());

    act(() =>
      tree.root
        .findByProps({ accessibilityLabel: 'How to draw a boundary' })
        .props.onPress(),
    );
    expect(isTutorialShowing(tree)).toBe(true);

    act(() => tree.unmount());
  });
});
