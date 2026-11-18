import { fromToMacro } from './timeMacro';
import type { MacroHandler } from './types';

export const macrosIndex = new Map<string, MacroHandler>([
  //   [DataLinkBuiltInVars.includeVars, AllVariablesMacro],
  //   [DataLinkBuiltInVars.keepTime, UrlTimeRangeMacro],
  //   ['__value', ValueMacro],
  //   ['__data', DataMacro],
  //   ['__series', SeriesMacro],
  //   ['__field', FieldMacro],
  //   ['__url', UrlMacro],
  ['__from', fromToMacro],
  ['__to', fromToMacro],
  //   ['__timezone', TimezoneMacro],
  //   ['__user', UserMacro],
  //   ['__org', OrgMacro],
  //   ['__namespace', NamespaceMacro],
  //   ['__theme', ThemeMacro],
  //   ['__interval', IntervalMacro],
  //   ['__interval_ms', IntervalMacro],
]);
