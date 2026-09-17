import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({
  selector: 'app-placeholder-page',
  template: `
    <section class="hq-card panel">
      <h2 class="hq-section-title">{{ title() }}</h2>
      <p class="hq-muted">
        This module is scaffolded and ready for the next build phase. The Jobie-inspired HQ shell,
        theme, and navigation are already in place.
      </p>
      <ul>
        <li>Shared layout and purple Jobie theme applied</li>
        <li>Connected mock data available from HqDataService</li>
        <li>Screen workflows will follow the UX plan priorities</li>
      </ul>
    </section>
  `,
  styles: `
    .panel {
      padding: 1.5rem;
    }
    p {
      margin: 0.5rem 0 1rem;
      max-width: 52rem;
      line-height: 1.6;
    }
    ul {
      margin: 0;
      padding-left: 1.1rem;
      color: var(--hq-text-muted);
      display: grid;
      gap: 0.45rem;
    }
  `,
})
export class PlaceholderPage {
  private readonly route = inject(ActivatedRoute);
  private readonly data = toSignal(this.route.data.pipe(map((d) => d['title'] as string)), {
    initialValue: 'Coming soon',
  });
  readonly title = computed(() => this.data() || 'Coming soon');
}
