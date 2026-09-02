import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { MarkdownBody } from '@/components/markdown-body';

describe('MarkdownBody', () => {
  it('reflows an editor-wrapped paragraph instead of freezing its wrap column', () => {
    const { container } = render(
      <MarkdownBody>
        {[
          'A dispatcher-policy edit made from the console Settings view is accepted,',
          'persisted as a COMPLETED command AND a domain event, and then silently fails to',
          'take effect.',
        ].join('\n')}
      </MarkdownBody>,
    );

    expect(container.querySelectorAll('br')).toHaveLength(0);
    expect(container.querySelector('p')?.textContent).toBe(
      'A dispatcher-policy edit made from the console Settings view is accepted, ' +
        'persisted as a COMPLETED command AND a domain event, and then silently fails to ' +
        'take effect.',
    );
  });

  it('still breaks the line where the author broke it', () => {
    const { container } = render(
      <MarkdownBody>{'Live Settings view renders:\nWIP cap  [ 5 ]'}</MarkdownBody>,
    );

    expect(container.querySelectorAll('br')).toHaveLength(1);
  });

  it('places no width cap on the rendered body', () => {
    const { container } = render(<MarkdownBody>{'Some description text.'}</MarkdownBody>);

    const prose = container.querySelector('.prose') as HTMLElement;
    expect(prose).toHaveClass('max-w-none');
    expect(prose.className).not.toMatch(/(?:^|\s)max-w-(?!none)/);
  });
});
