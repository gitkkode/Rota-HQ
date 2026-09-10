import { Component, input } from '@angular/core';

@Component({
  selector: 'app-hq-empty-state',
  template: `
    <div class="hq-empty-state">
      @if (icon()) {
        <span class="icon">{{ icon() }}</span>
      }
      <h3>{{ title() }}</h3>
      @if (description()) {
        <p>{{ description() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .hq-empty-state {
      padding: 2.5rem 1.5rem;
      text-align: center;
      color: var(--hq-text-muted);
    }

    .icon {
      display: block;
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    h3 {
      margin: 0 0 0.35rem;
      color: var(--hq-text);
      font-size: 1rem;
    }

    p {
      margin: 0 0 1rem;
      font-size: 0.84rem;
      line-height: 1.5;
      max-width: 28rem;
      margin-inline: auto;
    }
  `,
})
export class HqEmptyState {
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly icon = input<string>('');
}
