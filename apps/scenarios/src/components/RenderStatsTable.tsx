import { css } from '@emotion/css';
import { Button, Stack } from '@grafana/ui';

import { resetRenderStats, useRenderStats } from '../renderStats/renderStats';

/**
 * What the probes counted since the last reset. It sits outside the probed
 * components, so its own renders don't count.
 */
export function RenderStatsTable() {
  const stats = useRenderStats();
  const ids = [
    ...new Set([...Object.keys(stats.renders), ...Object.keys(stats.values)]),
  ];

  return (
    <Stack direction="column" gap={1}>
      <Stack alignItems="center">
        <h4 className={heading}>Since last reset</h4>
        <Button size="sm" variant="secondary" onClick={resetRenderStats}>
          Reset counts
        </Button>
      </Stack>
      <table data-testid="render-stats">
        <thead>
          <tr>
            <th align="left">Probe</th>
            <th align="left">Commits</th>
            <th align="left">Values</th>
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => (
            <tr key={id}>
              <td valign="top">{id}</td>
              <td valign="top">{stats.renders[id] ?? '-'}</td>
              <td>
                {(stats.values[id] ?? []).map((value, index) => (
                  <div key={index}>{value}</div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Stack>
  );
}

const heading = css({ margin: 0 });
