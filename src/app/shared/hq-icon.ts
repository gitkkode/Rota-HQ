import { Component, computed, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { resolveHqLucideIconName } from './hq-lucide-icons';

/** Lucide-powered icon wrapper used across Workforce HQ. */
@Component({
  selector: 'app-hq-icon',
  imports: [LucideDynamicIcon],
  template: `
    <svg
      lucideIcon
      [lucideIcon]="resolvedName()"
      [size]="size()"
      [strokeWidth]="effectiveStrokeWidth()"
      [color]="resolvedColor()"
    />
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
      color: inherit;
      flex-shrink: 0;
    }

    svg {
      display: block;
    }
  `,
})
export class HqIcon {
  readonly name = input.required<string>();
  readonly size = input(20);
  /** Legacy alias for strokeWidth. */
  readonly weight = input(2.25);
  readonly strokeWidth = input<number | undefined>(undefined);
  readonly color = input<string | undefined>(undefined);

  readonly resolvedName = computed(() => resolveHqLucideIconName(this.name()));
  readonly effectiveStrokeWidth = computed(() => this.strokeWidth() ?? this.weight());
  readonly resolvedColor = computed(() => this.color() ?? 'currentColor');
}
