import { config } from '@grafana/runtime';

import type { FormatVariable } from '../interpolation/formatRegistry';
import type {
  CustomVariableValue,
  InterpolationFormatParameter,
  QueryUIScopedVars,
} from '../types';

/**
 * Handles `${__url}`, `${__url.path}` and `${__url.params}`, read from the
 * `__location` scoped var. The URL and path start with the Grafana sub path.
 *
 * `${__url.params}` takes options in place of a format:
 * `${__url.params:exclude:from,to}` drops those query parameters, and
 * `${__url.params:include:from,to}` keeps only those.
 */
export function urlMacro(
  name: string,
  match: string,
  scopedVars: QueryUIScopedVars | undefined,
): FormatVariable {
  return {
    name: name,
    getValue: (fieldPath?: string) => {
      const location = scopedVars?.__location?.value;

      if (!location) {
        return match;
      }

      const subUrl = config.appSubUrl ?? '';

      switch (fieldPath ?? '') {
        case 'params':
          return new UrlParamsFormatter(location.search);
        case 'path':
          return subUrl + location.pathname;
        case '':
        default:
          return subUrl + location.pathname + location.search;
      }
    },
  };
}

class UrlParamsFormatter implements CustomVariableValue {
  public constructor(private _search: string) {}

  public formatter(options?: InterpolationFormatParameter): string {
    if (!options || typeof options !== 'string') {
      return this._search;
    }

    const [mode, paramList] = options.split(':');

    if (!paramList || (mode !== 'exclude' && mode !== 'include')) {
      return this._search;
    }

    const names = paramList.split(',');
    const params = new URLSearchParams(this._search);

    // Collect the keys first: deleting while iterating skips entries.
    for (const key of [...params.keys()]) {
      if (names.includes(key) === (mode === 'exclude')) {
        params.delete(key);
      }
    }

    return `?${params}`;
  }
}
