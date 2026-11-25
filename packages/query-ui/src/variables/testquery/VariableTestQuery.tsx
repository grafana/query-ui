import { useEffect } from 'react';

import { useVariable } from '../../hooks/useVariable';
import type { VariableValue } from '../types';
import { queryMetricTree } from './metricTree';

export interface Props {
  name: string;
  query: string;
  delay?: number;
}

export function VariableTestQuery({ name, query, delay }: Props) {
  useVariableTestQuery(name, query, delay);
  return null;
}

export function useVariableTestQuery(
  name: string,
  query: string,
  delay?: number,
) {
  const { onOptionsChange } = useVariable<VariableValue>(name);

  useEffect(() => {
    const cancel = setTimeout(() => {
      const nodes = queryMetricTree(query || '');

      // Handing the options over checks the value against them and ends loading
      if (nodes.length > 0) {
        onOptionsChange(
          nodes.map((node) => ({ value: node.name, label: node.name })),
        );
      }
    }, delay || 0);

    return () => {
      clearTimeout(cancel);
    };
  }, [query, delay, onOptionsChange]);
}
