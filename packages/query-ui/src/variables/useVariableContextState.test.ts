import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

import { CacheProvider } from '../caching/CacheContext';
import { MemoryCache } from '../caching/MemoryCache';
import { UrlStateProvider } from '../url/UrlStateContext';
import type { VariableValue, VariableValueOrValues } from './types';
import {
  useVariableContextState,
  type VariableValueStateInput,
} from './useVariableContextState';

const a = { value: 'a', label: 'A' };
const b = { value: 'b', label: 'B' };
const c = { value: 'c', label: 'C' };

/**
 * Renders the hook under a router at `entry`, along with the current search
 * string and a navigate function to change the URL from outside. `cache` is the
 * one a remembered value goes to; each render gets its own otherwise.
 */
function renderState<T extends VariableValueOrValues>(
  input: Omit<VariableValueStateInput<T>, 'name'>,
  entry = '/',
  cache = new MemoryCache(),
) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(CacheProvider, {
      cache,
      children: createElement(
        MemoryRouter,
        { initialEntries: [entry] },
        createElement(UrlStateProvider, null, children),
      ),
    });

  return renderHook(
    () => ({
      variable: useVariableContextState<T>({ name: 'test', ...input }),
      search: useLocation().search,
      navigate: useNavigate(),
    }),
    { wrapper },
  );
}

describe('useVariableContextState', () => {
  describe('When options are given', () => {
    it('Should start from them', () => {
      const { result } = renderState({ value: a, options: [a, b] });

      expect(result.current.variable.options).toEqual([a, b]);
    });

    it('Should label a value from the url with the matching option', () => {
      const { result } = renderState(
        { value: { value: 'a' }, options: [a, b] },
        '/?var-test=b',
      );

      expect(result.current.variable.value).toEqual(b);
    });
  });

  describe('When synced to the url', () => {
    const foo = { value: 'foo', label: 'Foo' };

    it('Should start from the value in the url', () => {
      const { result } = renderState({ value: foo }, '/?var-test=bar');

      expect(result.current.variable.getValue()).toBe('bar');
    });

    it('Should write changes to the url', () => {
      const { result } = renderState<VariableValue>({ value: foo });

      act(() => result.current.variable.onChange({ value: 'baz' }));

      expect(result.current.variable.getValue()).toBe('baz');
      expect(result.current.search).toBe('?var-test=baz');
    });

    it('Should follow a change to the url made from outside', () => {
      const { result } = renderState({ value: foo }, '/?var-test=bar');

      act(() => result.current.navigate({ search: '?var-test=qux' }));
      expect(result.current.variable.getValue()).toBe('qux');

      // A parameter that is gone puts the variable back to where it started
      act(() => result.current.navigate({ search: '' }));
      expect(result.current.variable.value).toEqual(foo);
    });

    it('Should leave the url alone with skipUrlSync', () => {
      const { result } = renderState<VariableValue>(
        { value: foo, skipUrlSync: true },
        '/?var-test=bar',
      );

      expect(result.current.variable.getValue()).toBe('foo');

      act(() => result.current.variable.onChange({ value: 'baz' }));

      expect(result.current.variable.getValue()).toBe('baz');
      expect(result.current.search).toBe('?var-test=bar');
    });
  });

  describe('When the value is a list', () => {
    it('Should return every value and label', () => {
      const { result } = renderState({ value: [a, b] });

      expect(result.current.variable.getValue()).toEqual(['a', 'b']);
      expect(result.current.variable.getValue(undefined, true)).toEqual([
        'A',
        'B',
      ]);
    });

    it('Should start from the values in the url', () => {
      const { result } = renderState(
        { value: [a, b] },
        '/?var-test=x&var-test=y',
      );

      expect(result.current.variable.getValue()).toEqual(['x', 'y']);
    });

    it('Should read a single parameter as a list of one', () => {
      const { result } = renderState({ value: [a, b] }, '/?var-test=x');

      expect(result.current.variable.getValue()).toEqual(['x']);
    });

    it('Should write one parameter per value to the url', () => {
      const { result } = renderState<VariableValue[]>({ value: [a, b] });

      act(() => result.current.variable.onChange([c, { value: 'd' }]));

      expect(result.current.variable.getValue()).toEqual(['c', 'd']);
      expect(result.current.search).toBe('?var-test=c&var-test=d');

      act(() => result.current.variable.onChange([]));

      expect(result.current.variable.getValue()).toEqual([]);
      expect(result.current.search).toBe('');
    });

    it('Should follow a change to the url made from outside', () => {
      const { result } = renderState({ value: [a, b] }, '/?var-test=x');

      act(() => result.current.navigate({ search: '?var-test=y&var-test=z' }));
      expect(result.current.variable.getValue()).toEqual(['y', 'z']);

      act(() => result.current.navigate({ search: '' }));
      expect(result.current.variable.value).toEqual([a, b]);
    });
  });

  describe('When the value is remembered', () => {
    it('Should start a later mount from the value the last one had', () => {
      const cache = new MemoryCache();
      const first = renderState<VariableValue>(
        { value: a, rememberValue: true },
        '/',
        cache,
      );

      act(() => first.result.current.variable.onChange(b));
      first.unmount();

      const { result } = renderState(
        { value: a, rememberValue: true },
        '/',
        cache,
      );

      expect(result.current.variable.value).toEqual(b);
    });

    it('Should prefer a value in the url', () => {
      const cache = new MemoryCache();
      cache.set('test', b);

      const { result } = renderState(
        { value: a, rememberValue: true },
        '/?var-test=c',
        cache,
      );

      expect(result.current.variable.getValue()).toBe('c');
    });

    it('Should go back to the remembered value when the url parameter is removed', () => {
      const cache = new MemoryCache();
      cache.set('test', b);

      const { result } = renderState(
        { value: a, rememberValue: true },
        '/?var-test=c',
        cache,
      );
      act(() => result.current.navigate({ search: '' }));

      expect(result.current.variable.value).toEqual(b);
    });

    it('Should not remember an empty value', () => {
      const cache = new MemoryCache();
      renderState({ value: { value: '' }, rememberValue: true }, '/', cache);

      expect(cache.has('test')).toBe(false);
    });

    it('Should ignore a remembered list for a single-value variable', () => {
      const cache = new MemoryCache();
      cache.set('test', [b]);

      const { result } = renderState(
        { value: a, rememberValue: true },
        '/',
        cache,
      );

      expect(result.current.variable.value).toEqual(a);
    });

    it('Should ignore the cache without rememberValue', () => {
      const cache = new MemoryCache();
      cache.set('test', b);

      const { result } = renderState({ value: a }, '/', cache);
      act(() => result.current.variable.onChange(c));

      expect(result.current.variable.value).toEqual(c);
      expect(cache.get('test')).toEqual(b);
    });
  });

  describe('When the options change', () => {
    it('Should end loading', () => {
      const { result } = renderState({ value: a, loading: true });

      act(() => result.current.variable.onOptionsChange([a]));

      expect(result.current.variable.loading).toBe(false);
      expect(result.current.variable.options).toEqual([a]);
    });

    it('Should keep a value that is one of them, with its label, and leave the url alone', () => {
      const { result } = renderState({ value: { value: 'b' } });

      act(() => result.current.variable.onOptionsChange([a, b]));

      expect(result.current.variable.value).toEqual(b);
      expect(result.current.search).toBe('');
    });

    it('Should select the first option when the value is not one of them', () => {
      const { result } = renderState({ value: c }, '/?var-test=c');

      act(() => result.current.variable.onOptionsChange([a, b]));

      expect(result.current.variable.value).toEqual(a);
      expect(result.current.search).toBe('?var-test=a');
    });

    it('Should clear the value when there are no options', () => {
      const { result } = renderState({ value: a });

      act(() => result.current.variable.onOptionsChange([]));

      expect(result.current.variable.value).toEqual({ value: '', label: '' });
    });

    it('Should check a value set in the same event', () => {
      const { result } = renderState<VariableValue>({ value: c });

      act(() => {
        result.current.variable.onChange(b);
        result.current.variable.onOptionsChange([a, b]);
      });

      expect(result.current.variable.value).toEqual(b);
    });

    it('Should keep the values of a list that are options', () => {
      const { result } = renderState({ value: [a, c, { value: 'b' }] });

      act(() => result.current.variable.onOptionsChange([a, b]));

      expect(result.current.variable.value).toEqual([a, b]);
      expect(result.current.search).toBe('?var-test=a&var-test=b');
    });

    it('Should select the first option as a list when none of the values are options', () => {
      const { result } = renderState({ value: [c] });

      act(() => result.current.variable.onOptionsChange([a, b]));

      expect(result.current.variable.value).toEqual([a]);
    });
  });
});
