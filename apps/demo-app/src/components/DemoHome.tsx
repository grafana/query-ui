import { Stack, TextLink } from '@grafana/ui';
import { demos } from '../demos';
import { prefixRoute } from '../utils/utils.routing';
import { PageWrapper } from './PageWrapper';

export function DemoHome() {
  return (
    <PageWrapper title="Select demo / scenario">
      <Stack direction="column" gap={2}>
        {demos.map((demo) => (
          <TextLink key={demo.route} href={prefixRoute(demo.route)}>
            {demo.label}
          </TextLink>
        ))}
      </Stack>
    </PageWrapper>
  );
}
