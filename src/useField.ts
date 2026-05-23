import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type RefObject,
} from "react";
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

/**
 * Register the element that should receive focus when the form locates
 * an error on this field (e.g. on submit). Built-in fields use this so
 * "focus first invalid field" lands on the right element.
 */
export function useFieldFocus(
  name: string,
  ref: RefObject<HTMLElement | null>,
) {
  const store = useFormStore();
  useEffect(() => {
    return store.registerFocus(name, () => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      if (typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, [store, name, ref]);
}

/** Subscribe to form-level state (submitting, formError). */
export function useFormState(): {
  submitting: boolean;
  formError: string | null;
} {
  const store = useFormStore();
  const subscribe = useCallback(
    (cb: () => void) => store.subscribeMeta(cb),
    [store],
  );
  const submitting = useSyncExternalStore(
    subscribe,
    () => store.isSubmitting(),
    () => store.isSubmitting(),
  );
  const formError = useSyncExternalStore(
    subscribe,
    () => store.getFormError(),
    () => store.getFormError(),
  );
  return { submitting, formError };
}
