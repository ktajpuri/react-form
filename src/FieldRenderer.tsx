import { memo } from "react";
import { useField } from "./useField";
import type { FieldRegistry } from "./registry";
import type { FieldSchema } from "./types";

interface Props {
  schema: FieldSchema;
  registry: FieldRegistry;
}

// FieldRenderer subscribes to visibility for its field. It only re-renders
// when visibility toggles — never on value changes (those are handled inside
// the field component itself via useField).
function FieldRendererImpl({ schema, registry }: Props) {
  const { visible } = useField(schema.name);
  if (!visible) return null;
  const Component = registry[schema.type];
  if (!Component) {
    // eslint-disable-next-line no-console
    console.warn(`[react-form] No component registered for type "${schema.type}"`);
    return null;
  }
  return <Component schema={schema} />;
}

export const FieldRenderer = memo(FieldRendererImpl);
