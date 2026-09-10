import { Component, input } from '@angular/core';

@Component({
  selector: 'app-hq-skeleton',
  template: `
    <div class="hq-skeleton" [class.block]="variant() === 'block'" [style.height]="height()" [style.width]="width()">
      @if (variant() === 'lines') {
        @for (line of lineArray(); track $index) {
          <span class="line" [style.width.%]="lineWidths()[$index] ?? 100"></span>
        }
      }
    </div>
  `,
  styles: `
    .hq-skeleton {
      border-radius: var(--hq-radius-sm);
      background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%);
      background-size: 200% 100%;
      animation: shimmer 1.2s ease-in-out infinite;
    }

    .hq-skeleton.block {
      width: 100%;
    }

    .hq-skeleton:not(.block) {
      display: grid;
      gap: 0.55rem;
      padding: 0.25rem 0;
      background: none;
      animation: none;
    }

    .line {
      display: block;
      height: 0.72rem;
      border-radius: 999px;
      background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%);
      background-size: 200% 100%;
      animation: shimmer 1.2s ease-in-out infinite;
    }

    @keyframes shimmer {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }
  `,
})
export class HqSkeleton {
  readonly variant = input<'block' | 'lines'>('block');
  readonly height = input('1rem');
  readonly width = input('100%');
  readonly lines = input(3);
  readonly lineWidths = input<number[]>([100, 92, 78]);

  lineArray(): number[] {
    return Array.from({ length: this.lines() }, (_, i) => i);
  }
}
