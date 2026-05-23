import { createContext, useContext, type ReactNode } from "react";
import type { FieldComponent } from "./types";

export type FieldRegistry = Record<string, FieldComponent<any>>;

const FieldRegistryContext = createContext<FieldRegistry>({});

export function FieldRegistryProvider({
  value,
  children,
}: {
  value: FieldRegistry;
  children: ReactNode;
}) {
  return (
    <FieldRegistryContext.Provider value={value}>
      {children}
    </FieldRegistryContext.Provider>
  );
}

export function useFieldRegistry(): FieldRegistry {
  return useContext(FieldRegistryContext);
}
