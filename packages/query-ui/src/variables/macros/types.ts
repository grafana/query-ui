import type { ScopedVars } from '@grafana/data';

import type { FormatVariable } from '../interpolation/formatRegistry';

export interface MacroHandler {
  (
    name: string,
    match: string,
    scopedVars: ScopedVars | undefined,
  ): FormatVariable;
}
