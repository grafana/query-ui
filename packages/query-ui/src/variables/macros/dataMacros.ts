import {
  type DataContextScopedVar,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayValuesProxy,
  getFrameDisplayName,
} from '@grafana/data';

import { getFieldAccessor } from '../interpolation/fieldAccessorCache';
import type { FormatVariable } from '../interpolation/formatRegistry';
import type { QueryUIScopedVars } from '../types';
import { getTemplateProxyForField } from './templateProxies';

// The data macros read the `__dataContext` scoped var that panels pass for a
// value, row or field. Without it they return the whole expression, which
// leaves it intact so it can be interpolated later, once a data context exists.

/**
 * Handles `${__value}`, `${__value.raw}`, `${__value.numeric}`,
 * `${__value.text}` and `${__value.time}`.
 */
export function valueMacro(
  name: string,
  match: string,
  scopedVars: QueryUIScopedVars | undefined,
): FormatVariable {
  return {
    name: name,
    getValue: (fieldPath?: string) => {
      const dataContext: DataContextScopedVar | undefined =
        scopedVars?.__dataContext;

      if (!dataContext) {
        return match;
      }

      const { frame, rowIndex, field, calculatedValue } = dataContext.value;

      if (calculatedValue) {
        switch (fieldPath) {
          case 'numeric':
          case 'raw':
            return calculatedValue.numeric;
          case 'time':
            return '';
          case 'text':
          default:
            return formattedValueToString(calculatedValue);
        }
      }

      if (rowIndex == null) {
        return match;
      }

      if (fieldPath === 'time') {
        const timeField = frame.fields.find((f) => f.type === FieldType.time);
        return timeField?.values[rowIndex] ?? '';
      }

      if (!field) {
        return match;
      }

      const value = field.values[rowIndex];
      if (fieldPath === 'raw') {
        return value;
      }

      const displayProcessor = field.display ?? getFallbackDisplayProcessor();
      const result = displayProcessor(value);

      switch (fieldPath) {
        case 'numeric':
          return result.numeric;
        case 'text':
        default:
          return formattedValueToString(result);
      }
    },
  };
}

let fallbackDisplayProcessor: ReturnType<typeof getDisplayProcessor>;

function getFallbackDisplayProcessor() {
  fallbackDisplayProcessor ??= getDisplayProcessor();
  return fallbackDisplayProcessor;
}

/**
 * Handles `${__data.*}`: the frame `name` and `refId`, and the values of the
 * other fields on the same row, like `${__data.fields[0]}` or
 * `${__data.fields["Name"].text}`.
 */
export function dataMacro(
  name: string,
  match: string,
  scopedVars: QueryUIScopedVars | undefined,
): FormatVariable {
  return {
    name: name,
    getValue: (fieldPath?: string) => {
      const dataContext = scopedVars?.__dataContext;

      if (!dataContext || !fieldPath) {
        return match;
      }

      const { frame, rowIndex } = dataContext.value;

      if (rowIndex === undefined) {
        return match;
      }

      const obj = {
        name: frame.name,
        refId: frame.refId,
        fields: getFieldDisplayValuesProxy({ frame, rowIndex }),
      };

      return getFieldAccessor(fieldPath)(obj) ?? '';
    },
  };
}

/** Handles `${__series.name}`, the display name of the frame. */
export function seriesMacro(
  name: string,
  match: string,
  scopedVars: QueryUIScopedVars | undefined,
): FormatVariable {
  return {
    name: name,
    getValue: (fieldPath?: string) => {
      const dataContext = scopedVars?.__dataContext;

      if (!dataContext || fieldPath !== 'name') {
        return match;
      }

      const { frame, frameIndex } = dataContext.value;
      return getFrameDisplayName(frame, frameIndex);
    },
  };
}

/**
 * Handles `${__field.name}`, `${__field.displayName}` and
 * `${__field.labels.<label>}`. These only need the field, not a row, so they
 * work in field config options like the display name.
 */
export function fieldMacro(
  name: string,
  match: string,
  scopedVars: QueryUIScopedVars | undefined,
): FormatVariable {
  return {
    name: name,
    getValue: (fieldPath?: string) => {
      const dataContext = scopedVars?.__dataContext;

      if (!dataContext || !fieldPath) {
        return match;
      }

      const { frame, field, data } = dataContext.value;
      const obj = getTemplateProxyForField(field, frame, data);

      return getFieldAccessor(fieldPath)(obj) ?? '';
    },
  };
}
