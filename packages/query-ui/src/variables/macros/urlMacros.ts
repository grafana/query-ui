import {
  formatValue,
  type FormatVariable,
} from '../interpolation/formatRegistry';
import type {
  CustomVariableValue,
  InterpolationFormatParameter,
  QueryUIScopedVars,
} from '../types';
import { locationUtil } from '@grafana/data';

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

      switch (fieldPath ?? '') {
        case 'params':
          return new UrlParamsFormatter(name, location.search);
        case 'path':
          return locationUtil.assureBaseUrl(location.pathname);
        case '':
        default:
          return (
            locationUtil.assureBaseUrl(location.pathname) + location.search
          );
      }
    },
  };
}

class UrlParamsFormatter implements CustomVariableValue {
  public constructor(
    private _name: string,
    private _search: string,
  ) {}

  public formatter(options?: InterpolationFormatParameter): string {
    if (typeof options === 'string') {
      const [mode, paramList] = options.split(':');

      if (paramList && (mode === 'exclude' || mode === 'include')) {
        return this._filter(mode, paramList.split(','));
      }
    }

    // Anything else is a format like any other, so `${__url.params:html}` is
    // escaped instead of handed back as is.
    return formatValue(
      { name: this._name, getValue: () => this._search },
      this._search,
      options,
    );
  }

  private _filter(mode: 'exclude' | 'include', names: string[]): string {
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
