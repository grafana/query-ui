import type { FormatVariable } from '../interpolation/formatRegistry';
import type { QueryUIScopedVars } from '../types';

export interface MacroHandler {
  (
    name: string,
    match: string,
    scopedVars: QueryUIScopedVars | undefined,
  ): FormatVariable;
}
