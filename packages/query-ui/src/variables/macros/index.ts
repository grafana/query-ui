import { DataLinkBuiltInVars } from '@grafana/data';

import {
  namespaceMacro,
  orgMacro,
  themeMacro,
  userMacro,
} from './contextMacros';
import { dataMacro, fieldMacro, seriesMacro, valueMacro } from './dataMacros';
import {
  fromToMacro,
  intervalMacro,
  timeZoneMacro,
  urlTimeRangeMacro,
} from './timeMacro';
import type { MacroHandler } from './types';
import { urlMacro } from './urlMacros';

export const macrosIndex = new Map<string, MacroHandler>([
  // TODO: $__all_variables needs every variable in scope, not only the one
  // an expression names, which the variable context can't list yet.
  //   [DataLinkBuiltInVars.includeVars, AllVariablesMacro],
  [DataLinkBuiltInVars.keepTime, urlTimeRangeMacro],
  ['__value', valueMacro],
  ['__data', dataMacro],
  ['__series', seriesMacro],
  ['__field', fieldMacro],
  ['__url', urlMacro],
  ['__from', fromToMacro],
  ['__to', fromToMacro],
  ['__timezone', timeZoneMacro],
  ['__user', userMacro],
  ['__org', orgMacro],
  ['__namespace', namespaceMacro],
  ['__theme', themeMacro],
  ['__interval', intervalMacro],
  ['__interval_ms', intervalMacro],
]);
