import { afterEach, describe, expect, it } from 'vitest';
import { createTheme, type CurrentUserDTO } from '@grafana/data';
import { config } from '@grafana/runtime';

import { interpolate } from '../interpolation/useInterpolator';

function interpolateString(target: string) {
  return interpolate(target, undefined)[0];
}

describe('user macro', () => {
  it('Can interpolate ${__user.*} expressions', () => {
    const user: Partial<CurrentUserDTO> = {
      id: 10,
      login: 'user_login',
      email: 'user_email',
    };

    config.bootData.user = user as CurrentUserDTO;

    expect(interpolateString('$__user')).toBe('10');
    expect(interpolateString('${__user.id}')).toBe('10');
    expect(interpolateString('${__user.login}')).toBe('user_login');
    expect(interpolateString('${__user.email}')).toBe('user_email');
  });
});

describe('org macro', () => {
  it('Can interpolate ${__org.*} expressions', () => {
    const user: Partial<CurrentUserDTO> = {
      orgId: 15,
      orgName: 'My cool org',
    };

    config.bootData.user = user as CurrentUserDTO;

    expect(interpolateString('$__org')).toBe('15');
    expect(interpolateString('${__org.id}')).toBe('15');
    expect(interpolateString('${__org.name}')).toBe('My cool org');
  });
});

describe('namespace macro', () => {
  it.each(['stacks-123', 'default', 'org-15'])(
    'Can interpolate $__namespace as %s',
    (namespace) => {
      config.namespace = namespace;

      expect(interpolateString('$__namespace')).toBe(namespace);
      expect(
        interpolateString(
          'apis/dashboard.grafana.app/v1beta1/namespaces/${__namespace}/dashboards',
        ),
      ).toBe(
        `apis/dashboard.grafana.app/v1beta1/namespaces/${namespace}/dashboards`,
      );
    },
  );
});

describe('theme macro', () => {
  const originalTheme = config.theme2;

  afterEach(() => {
    config.theme2 = originalTheme;
  });

  it('Can interpolate ${__theme.*} expressions from the current theme', () => {
    const dark = createTheme({ colors: { mode: 'dark' } });
    const light = createTheme({ colors: { mode: 'light' } });

    config.theme2 = dark;
    expect(interpolateString('color: ${__theme.colors.text.primary}')).toBe(
      `color: ${dark.colors.text.primary}`,
    );

    config.theme2 = light;
    expect(interpolateString('color: ${__theme.colors.text.primary}')).toBe(
      `color: ${light.colors.text.primary}`,
    );
  });

  it('Interpolates a number token as its string form', () => {
    expect(interpolateString('${__theme.typography.fontSize}px')).toBe('14px');
  });

  it('Applies the requested format', () => {
    expect(
      interpolateString('${__theme.typography.fontFamilyMonospace:html}'),
    ).toBe('&#39;Roboto Mono&#39;, monospace');
    expect(interpolateString('${__theme.typography.fontSize:text}')).toBe('14');
  });

  it.each([
    { desc: 'no path', target: '${__theme}' },
    { desc: 'no braces', target: '$__theme' },
    { desc: 'an object', target: '${__theme.colors.text}' },
    { desc: 'a function', target: '${__theme.spacing}' },
    { desc: 'a missing path', target: '${__theme.colors.nope}' },
  ])('Leaves $desc unresolved', ({ target }) => {
    expect(interpolateString(target)).toBe(target);
  });
});
