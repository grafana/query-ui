import type { FormatVariable } from '../interpolation/formatRegistry';
import type { CustomVariableValue, QueryUIScopedVars } from '../types';

/**
 * Creates the variable a macro expression like `$__from` or `${__value.raw}`
 * resolves to. `match` is the whole expression: a macro returns it from
 * `getValue` when the scoped vars lack what it needs, which leaves the
 * expression intact so it can be interpolated later, once they are there.
 */
export interface MacroHandler {
  (
    name: string,
    match: string,
    scopedVars: QueryUIScopedVars | undefined,
  ): FormatVariable;
}

/**
 * A value the interpolator inserts as is, skipping the formatters. Without it,
 * a macro whose value is already formatted, like `$__url_time_range`, would be
 * escaped a second time.
 */
export class SkipFormattingValue implements CustomVariableValue {
  public constructor(private _value: string) {}

  public formatter(): string {
    return this._value;
  }
}
