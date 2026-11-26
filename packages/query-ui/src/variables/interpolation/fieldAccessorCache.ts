import { property } from 'lodash';

type FieldAccessor = (obj: unknown) => unknown;

const fieldAccessorCache: Record<string, FieldAccessor> = {};

/**
 * Returns a function that reads `fieldPath` (like `a.b[0]` or `fields["name"]`)
 * from an object. Accessors are cached per path, since the same expressions are
 * interpolated over and over.
 */
export function getFieldAccessor(fieldPath: string): FieldAccessor {
  const accessor = fieldAccessorCache[fieldPath];
  if (accessor) {
    return accessor;
  }

  return (fieldAccessorCache[fieldPath] = property(fieldPath));
}
