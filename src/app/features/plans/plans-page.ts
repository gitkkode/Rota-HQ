import { DatePipe } from '@angular/common';
import { HqCurrencyPipe } from '../../shared/hq-currency.pipe';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HqDataService } from '../../core/services/hq-data.service';
import { HqPageTabs } from '../../shared/hq-page-tabs';
import { HqIcon } from '../../shared/hq-icon';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';
import { HqRequirePermissionDirective } from '../../shared/hq-require-permission.directive';

@Component({
  selector: 'app-plans-page',
  imports: [RouterLink, HqCurrencyPipe, DatePipe, HqSelect, HqIcon, HqRequirePermissionDirective, HqPageTabs],
  templateUrl: './plans-page.html',
  styleUrl: './plans-page.scss',
})
export class PlansPage {
  readonly data = inject(HqDataService);
  readonly tab = signal<'plans' | 'features'>('plans');
  readonly viewMode = signal<'grid' | 'table'>('grid');
  readonly planStatusFilter = signal<string>('all');
  readonly featureCategory = signal<string>('all');
  readonly planFeatureFilter = signal('');

  readonly categories = computed(() => [
    'all',
    ...Array.from(new Set(this.data.features.map((f) => f.category))),
  ]);

  readonly featureCategoryOptions = computed<HqSelectOption[]>(() =>
    this.categories().map((cat) => ({
      value: cat,
      label: cat === 'all' ? 'All categories' : cat,
    })),
  );

  readonly filteredFeatures = computed(() => {
    const cat = this.featureCategory();
    return this.data.features.filter((f) => cat === 'all' || f.category === cat);
  });

  readonly filteredPlans = computed(() => {
    const featureId = this.planFeatureFilter();
    const status = this.planStatusFilter();
    return this.data.plans().filter((p) => {
      const matchesFeature = !featureId || p.featureIds.includes(featureId);
      const matchesStatus = status === 'all' || p.status === status;
      return matchesFeature && matchesStatus;
    });
  });

  readonly planStatusOptions: HqSelectOption[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Draft' },
    { value: 'retired', label: 'Retired' },
  ];

  plansWithFeature(featureId: string): string {
    return this.data
      .plans()
      .filter((p) => p.featureIds.includes(featureId))
      .map((p) => p.name)
      .join(', ');
  }

  viewPlansWithFeature(featureId: string): void {
    this.planFeatureFilter.set(featureId);
    this.tab.set('plans');
  }

  featureName(featureId: string): string {
    return this.data.features.find((f) => f.id === featureId)?.name ?? featureId;
  }

  planStatusClass(status: string): string {
    if (status === 'active') return 'hq-badge-active';
    if (status === 'draft') return 'hq-badge-trial';
    return 'hq-badge-archived';
  }

  toggleViewMode(): void {
    this.viewMode.update((mode) => (mode === 'grid' ? 'table' : 'grid'));
  }
}
