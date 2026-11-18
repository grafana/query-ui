import { VariableFormatID } from '@grafana/schema';

import {
  formatRegistry,
  type FormatValue,
  type FormatVariable,
} from './formatRegistry';

function testVariable(value: FormatValue, text?: FormatValue): FormatVariable {
  return {
    name: 'server',
    getValue: (fieldPath) => (fieldPath === 'text' ? text : value),
  };
}

function formatValue(
  formatId: string,
  value: FormatValue,
  text?: string,
  args: string[] = [],
): string {
  return formatRegistry
    .get(formatId)
    .formatter(value, args, testVariable(value, text));
}

describe('formatRegistry', () => {
  it('Can format values according to format', () => {
    expect(formatValue(VariableFormatID.Lucene, 'foo bar')).toBe('foo\\ bar');
    expect(formatValue(VariableFormatID.Lucene, '-1')).toBe('-1');
    expect(formatValue(VariableFormatID.Lucene, '-test')).toBe('\\-test');
    expect(formatValue(VariableFormatID.Lucene, ['foo bar', 'baz'])).toBe(
      '("foo\\ bar" OR "baz")',
    );
    expect(formatValue(VariableFormatID.Lucene, [])).toBe('__empty__');

    expect(formatValue(VariableFormatID.Glob, 'foo')).toBe('foo');
    expect(formatValue(VariableFormatID.Glob, ['AA', 'BB', 'C.*'])).toBe(
      '{AA,BB,C.*}',
    );

    expect(formatValue(VariableFormatID.Text, 'v', 'display text')).toBe(
      'display text',
    );

    expect(formatValue(VariableFormatID.Raw, [12, 13])).toBe('12,13');
    expect(formatValue(VariableFormatID.Raw, '#Æ³ ̇¹"Ä1"#!"#!½')).toBe(
      '#Æ³ ̇¹"Ä1"#!"#!½',
    );

    expect(formatValue(VariableFormatID.Regex, 'test.')).toBe('test\\.');
    expect(formatValue(VariableFormatID.Regex, ['test.'])).toBe('test\\.');
    expect(formatValue(VariableFormatID.Regex, ['test.', 'test2'])).toBe(
      '(test\\.|test2)',
    );

    expect(formatValue(VariableFormatID.Pipe, ['test', 'test2'])).toBe(
      'test|test2',
    );

    expect(formatValue(VariableFormatID.Distributed, ['test'])).toBe('test');
    expect(formatValue(VariableFormatID.Distributed, ['test', 'test2'])).toBe(
      'test,server=test2',
    );

    expect(formatValue(VariableFormatID.CSV, 'test')).toBe('test');
    expect(formatValue(VariableFormatID.CSV, ['test', 'test2'])).toBe(
      'test,test2',
    );

    expect(
      formatValue(VariableFormatID.HTML, '<script>alert(asd)</script>'),
    ).toBe('&lt;script&gt;alert(asd)&lt;/script&gt;');

    expect(formatValue(VariableFormatID.JSON, ['test', 12])).toBe(
      '["test",12]',
    );
    expect(formatValue(VariableFormatID.JSON, 'test')).toBe('test');

    expect(
      formatValue(VariableFormatID.PercentEncode, ['foo()bar BAZ', 'test2']),
    ).toBe('%7Bfoo%28%29bar%20BAZ%2Ctest2%7D');

    expect(formatValue(VariableFormatID.SingleQuote, 'test')).toBe(`'test'`);
    expect(formatValue(VariableFormatID.SingleQuote, ['test', `test'2`])).toBe(
      "'test','test\\'2'",
    );

    expect(formatValue(VariableFormatID.DoubleQuote, 'test')).toBe(`"test"`);
    expect(formatValue(VariableFormatID.DoubleQuote, ['test', `test"2`])).toBe(
      '"test","test\\"2"',
    );

    expect(formatValue(VariableFormatID.SQLString, "test'value")).toBe(
      `'test''value'`,
    );
    expect(formatValue(VariableFormatID.SQLString, 'test"value')).toBe(
      `'test\\"value'`,
    );
    expect(
      formatValue(VariableFormatID.SQLString, ['test', "test'value2"]),
    ).toBe(`'test','test''value2'`);
    expect(
      formatValue(VariableFormatID.SQLString, [
        'test',
        "test'value2",
        'test"value3',
      ]),
    ).toBe(`'test','test''value2','test\\"value3'`);

    expect(formatValue(VariableFormatID.Date, 1594671549254)).toBe(
      '2020-07-13T20:19:09.254Z',
    );
    expect(
      formatValue(VariableFormatID.Date, 1594671549254, 'text', ['seconds']),
    ).toBe('1594671549');
    expect(
      formatValue(VariableFormatID.Date, 1594671549254, 'text', ['iso']),
    ).toBe('2020-07-13T20:19:09.254Z');
    expect(
      formatValue(VariableFormatID.Date, 1594671549254, 'text', ['YYYY-MM']),
    ).toBe('2020-07');
    expect(
      formatValue(VariableFormatID.Date, 1594671549254, 'text', [
        'YYYY-MM',
        'ss',
      ]),
    ).toBe('2020-07:09');
    expect(
      formatValue(VariableFormatID.Date, 1594671549254, 'text', [
        'YYYY',
        'MM',
        'DD',
      ]),
    ).toBe('2020:07:13');
    expect(formatValue('join', 'hello', 'text', undefined)).toBe('hello'); // handles non-arrays
    expect(formatValue('join', ['hello'], 'text', undefined)).toBe('hello'); // handles arrays of 1 length
    expect(formatValue('join', ['hello', 'world'], 'text', undefined)).toBe(
      'hello,world',
    ); // has a default separator
    expect(formatValue('join', ['hello', 'world'], 'text', [' | '])).toBe(
      'hello | world',
    ); // has a custom separator

    // customqueryparam - multi-array values
    expect(
      formatValue('customqueryparam', ['api', 'database'], 'text', undefined),
    ).toBe('server=api&server=database'); // default name
    expect(
      formatValue('customqueryparam', ['api', 'database'], 'text', [
        'p-server',
      ]),
    ).toBe('p-server=api&p-server=database'); // custom name
    expect(
      formatValue('customqueryparam', ['api', 'database'], 'text', [
        'p-server',
        'v-',
      ]),
    ).toBe('p-server=v-api&p-server=v-database'); // value prefix

    // customqueryparam - multi-array values
    expect(formatValue('customqueryparam', ['api'], 'text', undefined)).toBe(
      'server=api',
    ); // default name
    expect(formatValue('customqueryparam', ['api'], 'text', ['p-server'])).toBe(
      'p-server=api',
    ); // custom name, optional value
    expect(
      formatValue('customqueryparam', ['api'], 'text', ['p-server', 'v-']),
    ).toBe('p-server=v-api'); // value prefix

    // customqueryparam - string values
    expect(formatValue('customqueryparam', 'api', 'text', undefined)).toBe(
      'server=api',
    ); // default name
    expect(formatValue('customqueryparam', 'api', 'text', ['p-server'])).toBe(
      'p-server=api',
    ); // custom name, optional value
    expect(
      formatValue('customqueryparam', 'api', 'text', ['p-server', 'v-']),
    ).toBe('p-server=v-api'); // value prefix

    // customqueryparam - url encoding
    expect(
      formatValue(
        'customqueryparam',
        ['mysql&postgres', 'databases!'],
        'text',
        ['p-server', 'v-'],
      ),
    ).toBe('p-server=v-mysql%26postgres&p-server=v-databases%21'); // variable value encoded
    expect(
      formatValue(
        'customqueryparam',
        ['mysql&postgres', 'databases!'],
        'text',
        ['space & ampersand!', 'v& '],
      ),
    ).toBe(
      'space%20%26%20ampersand%21=v%26%20mysql%26postgres&space%20%26%20ampersand%21=v%26%20databases%21',
    ); // custom name + prefix encoded

    expect(
      formatValue(
        VariableFormatID.UriEncode,
        '/any-path/any-second-path?query=foo()bar BAZ',
      ),
    ).toBe('/any-path/any-second-path?query=foo%28%29bar%20BAZ');
  });

  describe('text format', () => {
    it("uses the variable's text", () => {
      const { formatter } = formatRegistry.get(VariableFormatID.Text);

      expect(
        formatter('10', [], testVariable('10', 'Clementina DuBuque')),
      ).toBe('Clementina DuBuque');
    });

    it('joins multiple texts with +', () => {
      const { formatter } = formatRegistry.get(VariableFormatID.Text);

      expect(
        formatter(['1', '2'], [], testVariable(['1', '2'], ['hello', 'world'])),
      ).toBe('hello + world');
    });

    it('falls back to the value when there is no text', () => {
      const { formatter } = formatRegistry.get(VariableFormatID.Text);

      expect(formatter('10', [], testVariable('10'))).toBe('10');
    });

    it('uses the value for a field path', () => {
      const { formatter } = formatRegistry.get(VariableFormatID.Text);

      expect(
        formatter('alice', [], testVariable('10', 'Clementina'), 'username'),
      ).toBe('alice');
    });
  });

  describe('queryparam', () => {
    it('should url encode value', () => {
      const result = formatValue(VariableFormatID.QueryParam, 'helloAZ%=');
      expect(result).toBe('var-server=helloAZ%25%3D');
    });

    it('repeats the parameter for multiple values', () => {
      const result = formatValue(VariableFormatID.QueryParam, ['a', 'b c']);
      expect(result).toBe('var-server=a&var-server=b%20c');
    });
  });
});
