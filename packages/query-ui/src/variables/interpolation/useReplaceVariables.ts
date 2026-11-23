import { useContext, useCallback } from 'react';
import type { InterpolateFunction } from '@grafana/data';

import { useTimeRange } from '../../hooks/useTimeRange';
import { type InterpolationFormatParameter, VariableContext } from '../types';
import { interpolate } from './useInterpolator';

export function useReplaceVariables(): InterpolateFunction {
  const variableContext = useContext(VariableContext);
  const timeRange = useTimeRange();

  return useCallback(
    (value, scopedVars, format) => {
      const [result] = interpolate(
        value,
        variableContext,
        {
          ...(scopedVars ?? {}),
          __timeRange: { value: timeRange.value },
        },
        format as InterpolationFormatParameter,
      );
      return result;
    },
    [variableContext, timeRange],
  );
}
