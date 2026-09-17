import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HqDataService } from '../../core/services/hq-data.service';
import { HqBreadcrumbs } from '../../shared/hq-breadcrumbs';
import { HqEmptyState } from '../../shared/hq-empty-state';

@Component({
  selector: 'app-usage-page',
  imports: [RouterLink, HqBreadcrumbs, HqEmptyState],
  templateUrl: './usage-page.html',
  styleUrl: './usage-page.scss',
})
export class UsagePage {
  readonly data = inject(HqDataService);
  readonly toneFilter = signal<'all' | 'healthy' | 'near' | 'limit'>('all');
  readonly search = signal('');
  readonly breadcrumb = [{ label: 'Usage & limits' }];
  readonly summary = computed(() => {
    const rows = this.data.usageRows();
    return {
      healthy: rows.filter((r) => r.tone === 'healthy').length,
      near: rows.filter((r) => r.tone === 'near').length,
      limit: rows.filter((r) => r.tone === 'limit').length,
    };
  });

  readonly rows = computed(() => {
    const tone = this.toneFilter();
    const q = this.search().trim().toLowerCase();
    return this.data
      .usageRows()
      .filter((r) => {
        const matchesTone = tone === 'all' || r.tone === tone;
        const matchesSearch = !q || r.org.name.toLowerCase().includes(q);
        return matchesTone && matchesSearch;
      })
      .sort((a, b) => b.maxRatio - a.maxRatio);
  });
}
