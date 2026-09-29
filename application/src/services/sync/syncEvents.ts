type Listener = () => void;

const listeners = new Set<Listener>();

export const subscribeToSyncQueue = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const notifySyncQueueChanged = (): void => {
  listeners.forEach(listener => {
    try {
      listener();
    } catch {
      listeners.delete(listener);
    }
  });
};
