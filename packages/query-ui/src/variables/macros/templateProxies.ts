import {
  type DataFrame,
  type Field,
  formatLabels,
  getFieldDisplayName,
} from '@grafana/data';

/**
 * The object `${__field.*}` expressions read from. It is created often and
 * only read when a template uses it, so the proxy defers the costlier values
 * (like the display name) until a template asks for them.
 */
export function getTemplateProxyForField(
  field: Field,
  frame?: DataFrame,
  frames?: DataFrame[],
): object {
  return new Proxy(
    {},
    {
      get: (_obj, key) => {
        if (key === 'name') {
          return field.name;
        }

        if (key === 'displayName') {
          return getFieldDisplayName(field, frame, frames);
        }

        // formattedLabels is deprecated
        if (key === 'labels' || key === 'formattedLabels') {
          const labels = field.labels;

          if (!labels) {
            return '';
          }

          return {
            ...labels,
            __values: Object.values(labels).sort().join(', '),
            toString: () => formatLabels(labels, '', true),
          };
        }

        return undefined;
      },
    },
  );
}
