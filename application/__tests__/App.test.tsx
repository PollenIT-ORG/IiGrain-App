import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

const RENDER_TIMEOUT_MS = 60000;

test('renders correctly', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  expect(tree).toBeDefined();

  await ReactTestRenderer.act(() => {
    tree?.unmount();
  });
}, RENDER_TIMEOUT_MS);
