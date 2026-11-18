import type { ScopedVars, TimeRange } from '@grafana/data';

import type { FormatVariable } from '../interpolation/formatRegistry';

export function fromToMacro(
  name: string,
  _match: string,
  scopedVars: ScopedVars | undefined,
): FormatVariable {
  return {
    name: name,
    getValue: () => {
      const timeRange = scopedVars?.__timeRange?.value as TimeRange;

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
