// File: src/hooks/use-header-scroll.tsx
import { useRoute } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

interface HeaderScrollStore {
  read: (key: string) => number;
  update: (key: string, offset: number) => void;
  subscribe: (listener: () => void) => () => void;
}
const createStore = (): HeaderScrollStore => {
  const positions = new Map<string, number>();
  const listeners = new Set<() => void>();
  return {
    read: (key: string): number => positions.get(key) ?? 0,
    update: (key: string, offset: number): void => {
      // Twenty small steps limit JS updates while CSS interpolates the background.
      const next = Math.round(Math.min(1, Math.max(0, offset) / 96) * 20);
      if (next === (positions.get(key) ?? 0)) return;
      positions.set(key, next);
      listeners.forEach((listener: () => void): void => listener());
    },
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
  };
};
const Context = createContext<HeaderScrollStore | null>(null);
export const HeaderScrollProvider = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => {
  const [store] = useState<HeaderScrollStore>(createStore);
  return <Context.Provider value={store}>{children}</Context.Provider>;
};
const useStore = (): HeaderScrollStore => {
  const store = useContext(Context);
  if (!store) throw new Error("HeaderScrollProvider is required");
  return store;
};
export const useHeaderOpacity = (routeKey: string): number => {
  const store = useStore();
  return useSyncExternalStore(
    store.subscribe,
    (): number => store.read(routeKey),
    (): number => 0,
  );
};
export const useScreenScroll = (): ((
  event: NativeSyntheticEvent<NativeScrollEvent>,
) => void) => {
  const store = useStore();
  const { key } = useRoute();
  return useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
      store.update(key, event.nativeEvent.contentOffset.y);
    },
    [store, key],
  );
};
