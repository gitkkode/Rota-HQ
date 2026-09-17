import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BreadcrumbItem } from '../core/models/hq.models';
import { HqIcon } from './hq-icon';

@Component({
  selector: 'app-hq-breadcrumbs',
  imports: [RouterLink, HqIcon],
  template: `
    @if (items().length > 1 || items()[0]?.link) {
      <nav class="hq-breadcrumbs" aria-label="Breadcrumb">
        @for (item of items(); track item.label; let last = $last) {
          @if (!last && item.link) {
            <a [routerLink]="item.link">{{ item.label }}</a>
            <app-hq-icon name="chevron-right" [size]="12" />
          } @else {
            <span [class.current]="last">{{ item.label }}</span>
          }
        }
      </nav>
    }
  `,
  styles: `
    .hq-breadcrumbs {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-bottom: 0.85rem;
      font-size: 0.78rem;
    }

    a {
      color: var(--hq-primary);
      font-weight: 600;
    }

    span {
      color: var(--hq-text-muted);
    }

    span.current {
      color: var(--hq-text);
      font-weight: 600;
    }
  `,
})
export class HqBreadcrumbs {
  readonly items = input.required<BreadcrumbItem[]>();
}
