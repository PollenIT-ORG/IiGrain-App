/**
 * The coach mark's choreography (hand glides → taps → line grows → repeat) is
 * verified visually on-device — see docs/maps/CHANGELOG.md. These tests pin
 * the parts a screenshot can't: it renders nothing when not visible, it opens
 * on the same first hint text real drawing shows, and Skip always dismisses
 * regardless of which loop iteration is in flight.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import BoundaryDrawTutorial from '../src/maps/boundary/components/BoundaryDrawTutorial';
import { BOUNDARY_HINTS } from '../src/maps/boundary/engine/boundaryMessages';

describe('BoundaryDrawTutorial', () => {
  test('1 - renders nothing when not visible', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <BoundaryDrawTutorial visible={false} onDismiss={() => {}} />,
      );
    });
    expect(tree.toJSON()).toBeNull();
    act(() => tree.unmount());
  });

  test('2 - opens on the same hint text real drawing starts with', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <BoundaryDrawTutorial visible onDismiss={() => {}} />,
      );
    });
    const text = tree.root.findAll(
      node => typeof node.props.children === 'string',
    );
    expect(text.some(node => node.props.children === BOUNDARY_HINTS.drawEmpty)).toBe(
      true,
    );
    act(() => tree.unmount());
  });

  test('3 - Skip calls onDismiss exactly once, before the loop finishes', async () => {
    const onDismiss = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <BoundaryDrawTutorial visible onDismiss={onDismiss} />,
      );
    });

    const skip = tree.root.findByProps({ accessibilityLabel: 'Skip the tutorial' });
    // The dismiss animation is a real 200ms fade; onDismiss fires on completion.
    await act(async () => {
      skip.props.onPress();
      await new Promise<void>(resolve => setTimeout(() => resolve(), 260));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  test('4 - toggling visible off mid-loop does not throw and unmounts cleanly', async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <BoundaryDrawTutorial visible onDismiss={() => {}} />,
      );
    });
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(() => resolve(), 300));
    });
    expect(() => {
      act(() => {
        tree.update(<BoundaryDrawTutorial visible={false} onDismiss={() => {}} />);
      });
    }).not.toThrow();
    act(() => tree.unmount());
  });
});
