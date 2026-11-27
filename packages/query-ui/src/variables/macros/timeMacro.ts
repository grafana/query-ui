import { type DateTime, dateTimeFormat, urlUtil } from '@grafana/data';

import type { FormatVariable } from '../interpolation/formatRegistry';
import type { QueryUIScopedVars } from '../types';
import { SkipFormattingValue } from './types';

/**
 * Handles `$__from` and `$__to`: the bounds of `__timeRange` in epoch
 * milliseconds, or as a date in `__timeZone` with the `text` format.
 */
export function fromToMacro(
  name: string,
  _match: string,
  scopedVars: QueryUIScopedVars | undefined,
): FormatVariable {
  return {
    name: name,
    getValue: (_fieldPath?: string, returnLabel?: boolean) => {
      const timeRange = scopedVars?.__timeRange?.value;

      if (!timeRange) {
        return undefined;
      }

      const time = name === '__from' ? timeRange.from : timeRange.to;

      if (returnLabel) {
        return dateTimeFormat(time, {
          timeZone: scopedVars?.__timeZone?.value,
        });
      }

      return time.valueOf().toString();
    },
  };
}

/**
 * Handles `$__url_time_range`: the raw time range as URL parameters, like
 * `from=now-6h&to=now&timezone=utc`.
 */
export function urlTimeRangeMacro(
  name: string,
  match: string,
  scopedVars: QueryUIScopedVars | undefined,
): FormatVariable {
  return {
    name: name,
    getValue: () => {
      const timeRange = scopedVars?.__timeRange?.value;

      if (!timeRange) {
        return match;
      }

      const params: Record<string, string> = {
        from: rawToString(timeRange.raw.from),
        to: rawToString(timeRange.raw.to),
      };

      const timeZone = scopedVars?.__timeZone?.value;
      if (timeZone) {
        params.timezone = timeZone;
      }

      return new SkipFormattingValue(urlUtil.toUrlParams(params));
    },
  };
}

/**
 * Handles `$__timezone`: the time zone of the time range, with `browser`
 * resolved to the browser's own time zone.
 */
export function timeZoneMacro(
  name: string,
  match: string,
  scopedVars: QueryUIScopedVars | undefined,
): FormatVariable {
  return {
    name: name,
    getValue: () => {
      const timeZone = scopedVars?.__timeZone?.value;

      if (!timeZone) {
        return match;
      }

      if (timeZone === 'browser') {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      }

      return timeZone;
    },
  };
}

/**
 * Handles `$__interval` and `$__interval_ms`, read from the scoped vars of the
 * same name that a data query request carries.
 */
export function intervalMacro(
  name: string,
  match: string,
  scopedVars: QueryUIScopedVars | undefined,
): FormatVariable {
  return {
    name: name,
    getValue: (_fieldPath?: string, returnLabel?: boolean) => {
      const scopedVar = scopedVars?.[name];

      if (scopedVar?.value === undefined || scopedVar.value === null) {
        return match;
      }

      if (returnLabel && scopedVar.text !== undefined) {
        return scopedVar.text;
      }

      return scopedVar.value;
    },
  };
}

/** The raw bound the way the time range syncs it to the URL. */
function rawToString(bound: DateTime | string): string {
  return typeof bound === 'string' ? bound : bound.toISOString();
}
