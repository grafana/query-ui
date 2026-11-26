import { useContext, useCallback } from 'react';
import {
  type Location,
  useInRouterContext,
  useLocation,
} from 'react-router-dom';
import type { InterpolateFunction } from '@grafana/data';

import { useTimeRange } from '../../hooks/useTimeRange';
import { type InterpolationFormatParameter, VariableContext } from '../types';
import { interpolate } from './useInterpolator';

export function useReplaceVariables(): InterpolateFunction {
  const variableContext = useContext(VariableContext);
  const timeRange = useTimeRange();

  // Subscribing to the location gives a new function on every navigation, so a
  // component that interpolates `${__url}` renders again with the new URL.
  const location = useRouterLocation();

  return useCallback(
    (value, scopedVars, format) => {
      const [result] = interpolate(
        value,
        variableContext,
        {
          ...(scopedVars ?? {}),
          __timeRange: { value: timeRange.value },
          __timeZone: { value: timeRange.timeZone },
          ...(location && { __location: { value: location } }),
        },
        format as InterpolationFormatParameter,
      );
      return result;
    },
    [variableContext, timeRange, location],
  );
}

/** The router location, or undefined outside a router, where `useLocation` throws. */
function useRouterLocation(): Location | undefined {
  // A component is inside a router or not for its whole life, so the hooks it
  // calls stay the same from render to render.
  if (!useInRouterContext()) {
    return undefined;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useLocation();
}
