import type { Location } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { config } from '@grafana/runtime';

import { interpolate } from '../interpolation/useInterpolator';
import type { QueryUIScopedVars } from '../types';

/** Interpolates `target` with `url` (path and query) as the current location. */
function interpolateWithUrl(target: string, url: string) {
  const { pathname, search } = new URL(url, 'http://localhost');
  const location: Location = {
    pathname,
    search,
    hash: '',
    state: null,
    key: 'default',
  };
  const scopedVars: QueryUIScopedVars = { __location: { value: location } };

  return interpolate(target, undefined, scopedVars)[0];
}

describe('url macros', () => {
  it('Can get full url via ${__url}', () => {
    expect(
      interpolateWithUrl('$__url', '/my-plugin/my-page?from=now-5m&to=now'),
    ).toBe('/my-plugin/my-page?from=now-5m&to=now');
  });

  it('Can get only path via ${__url.path}', () => {
    expect(
      interpolateWithUrl(
        '${__url.path}',
        '/my-plugin/my-page?from=now-5m&to=now',
      ),
    ).toBe('/my-plugin/my-page');
  });

  it('${__url} and ${__url.path} includes grafana sub path', () => {
    config.appSubUrl = '/grafana';

    const url = '/my-plugin/my-page?from=now-5m&to=now';
    expect(interpolateWithUrl('${__url}', url)).toBe(
      '/grafana/my-plugin/my-page?from=now-5m&to=now',
    );
    expect(interpolateWithUrl('${__url.path}', url)).toBe(
      '/grafana/my-plugin/my-page',
    );

    config.appSubUrl = '';
  });

  it('Can get only state via ${__url.params}', () => {
    expect(
      interpolateWithUrl(
        '${__url.params}',
        '/my-plugin/my-page?from=now-5m&to=now',
      ),
    ).toBe('?from=now-5m&to=now');
  });

  it('Can exclude query param via ${__url.params:exclude:from}', () => {
    expect(
      interpolateWithUrl(
        '${__url.params:exclude:from,var-test}',
        '/my-plugin/my-page?from=now-5m&to=now&var-test=hello&var-test2=world',
      ),
    ).toBe('?to=now&var-test2=world');
  });

  it('Can specify query params to include via ${__url.params:include:from,var-test}', () => {
    expect(
      interpolateWithUrl(
        '${__url.params:include:from,var-test}',
        '/my-plugin/my-page?from=now-5m&to=now&var-test=hello&var-test2=world',
      ),
    ).toBe('?from=now-5m&var-test=hello');
  });

  it('Applies other formats to ${__url.params} like to any value', () => {
    const url = '/my-plugin/my-page?a=1&b=2';

    expect(interpolateWithUrl('${__url.params:html}', url)).toBe(
      '?a=1&amp;b=2',
    );
    expect(interpolateWithUrl('${__url.params:percentencode}', url)).toBe(
      '%3Fa%3D1%26b%3D2',
    );
  });

  it('Does not interpolate the variable expressions a URL holds', () => {
    const url = '/my-plugin/my-page?a=${__url.params}&b=$__url';

    expect(interpolateWithUrl('${__url.params}', url)).toBe(
      '?a=${__url.params}&b=$__url',
    );
  });

  it('Leaves the expression intact when there is no location', () => {
    expect(interpolate('${__url.path}', undefined, {})[0]).toBe(
      '${__url.path}',
    );
  });
});
