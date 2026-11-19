import type { FormatVariable } from '../interpolation/formatRegistry';
import type { QueryUIScopedVars } from '../types';

export function fromToMacro(
  name: string,
  _match: string,
  scopedVars: QueryUIScopedVars | undefined,
): FormatVariable {
  return {
    name: name,
    getValue: () => {
      const timeRange = scopedVars?.__timeRange?.value;

      if (!timeRange) {
        return undefined;
      }

      if (name === '__from') {
        return timeRange.from.valueOf().toString();
      }

      return timeRange.to.valueOf().toString();
    },
  };
}
