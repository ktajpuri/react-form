import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import type { FormStore } from "./store";

export const FormStoreContext = createContext<FormStore | null>(null);

export function useFormStore(): FormStore {
  const store = useContext(FormStoreContext);
  if (!store) {
    throw new Error("useFormStore must be used inside <Form/>");
  }
  return store;
}

export interface UseFieldResult {
  value: unknown;
  error: string | undefined;
  visible: boolean;
  touched: boolean;
  pending: boolean;
  setValue: (v: unknown) => void;
  onBlur: () => void;
}

export function useField(name: string): UseFieldResult {
  const store = useFormStore();

  const subscribe = useCallback(
    (cb: () => void) => store.subscribe(name, cb),
    [store, name],
  );

  // We snapshot a small object; React will re-render only when the snapshot changes.
  // To keep `useSyncExternalStore` stable, we read primitive fields and compose at the top.
  const value = useSyncExternalStore(
    subscribe,
    () => store.getValue(name),
    () => store.getValue(name),
  );
  const error = useSyncExternalStore(
    subscribe,
    () => store.getError(name),
    () => store.getError(name),
  );
  const visible = useSyncExternalStore(
    subscribe,
    () => store.isVisible(name),
    () => store.isVisible(name),
  );
  const touched = useSyncExternalStore(
    subscribe,
    () => store.isTouched(name),
    () => store.isTouched(name),
  );
  const pending = useSyncExternalStore(
    subscribe,
    () => store.isPending(name),
    () => store.isPending(name),
  );

  const setValue = useCallback(
    (v: unknown) => store.setValue(name, v),
    [store, name],
  );
  const onBlur = useCallback(() => store.setTouched(name), [store, name]);

  return { value, error, visible, touched, pending, setValue, onBlur };
}
