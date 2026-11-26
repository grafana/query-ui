import { config } from '@grafana/runtime';

import { getFieldAccessor } from '../interpolation/fieldAccessorCache';
import type { FormatVariable } from '../interpolation/formatRegistry';

/**
 * Handles `${__user.id}`, `${__user.login}` and `${__user.email}`. A bare
 * `$__user` is the user id.
 */
export function userMacro(name: string): FormatVariable {
  return {
    name: name,
    getValue: (fieldPath?: string) => {
      const user = config.bootData.user;

      switch (fieldPath) {
        case 'login':
          return user.login;
        case 'email':
          return user.email;
        case 'id':
        default:
          return String(user.id);
      }
    },
  };
}

/** Handles `${__org.id}` and `${__org.name}`. A bare `$__org` is the org id. */
export function orgMacro(name: string): FormatVariable {
  return {
    name: name,
    getValue: (fieldPath?: string) => {
      const user = config.bootData.user;

      switch (fieldPath) {
        case 'name':
          return user.orgName;
        case 'id':
        default:
          return String(user.orgId);
      }
    },
  };
}

/**
 * Handles `$__namespace`, the Kubernetes namespace of the current instance.
 * Grafana APIs are namespaced, so queries against them need it to build the URL.
 */
export function namespaceMacro(name: string): FormatVariable {
  return {
    name: name,
    getValue: () => config.namespace,
  };
}

/**
 * Handles `${__theme.colors.text.primary}` and other paths to a value in the
 * current theme. A path that doesn't lead to a string, number or boolean
 * leaves the expression intact.
 */
export function themeMacro(name: string, match: string): FormatVariable {
  return {
    name: name,
    getValue: (fieldPath?: string) => {
      if (!fieldPath) {
        return match;
      }

      const value = getFieldAccessor(fieldPath)(config.theme2);

      // Only leaf values: an object would render as [object Object] and a
      // function as its source code.
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        return String(value);
      }

      return match;
    },
  };
}
