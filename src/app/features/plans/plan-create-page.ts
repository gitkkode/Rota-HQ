import { HqCurrencyPipe } from '../../shared/hq-currency.pipe';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Feature } from '../../core/models/hq.models';
import { HqDataService } from '../../core/services/hq-data.service';
import { PlanInterval } from '../../core/models/hq.models';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';
import { HqToastService } from '../../shared/hq-toast.service';

@Component({
  selector: 'app-plan-create-page',
  imports: [RouterLink, HqCurrencyPipe, HqSelect],
  templateUrl: './plan-create-page.html',
  styleUrl: './plan-create-page.scss',
})
export class PlanCreatePage {
  readonly data = inject(HqDataService);
  private readonly router = inject(Router);
  private readonly toast = inject(HqToastService);

  readonly name = signal('');
  readonly priceMonthly = signal(12499);
  readonly seatsIncluded = signal(50);
  readonly locationsIncluded = signal(2);
  readonly interval = signal<PlanInterval>('monthly');
  readonly status = signal<'draft' | 'active'>('draft');
  readonly notes = signal('');
  readonly submitting = signal(false);
  readonly selectedFeatureIds = signal<string[]>(
    this.data.features.filter((f) => !f.optional).map((f) => f.id),
  );

  readonly intervalOptions: HqSelectOption[] = [
    { value: 'monthly', label: 'Monthly billing' },
    { value: 'yearly', label: 'Yearly billing' },
  ];

  readonly statusOptions: HqSelectOption[] = [
    { value: 'draft', label: 'Draft (not assignable)' },
    { value: 'active', label: 'Active (available to customers)' },
  ];

  readonly featuresByCategory = computed(() => {
    const groups = new Map<string, Feature[]>();
    for (const feature of this.data.features) {
      const list = groups.get(feature.category) ?? [];
      list.push(feature);
      groups.set(feature.category, list);
    }
    return Array.from(groups.entries());
  });

  readonly selectedFeatures = computed(() =>
    this.data.features.filter((f) => this.selectedFeatureIds().includes(f.id)),
  );

  readonly selectedByCategory = computed(() => {
    const groups = new Map<string, Feature[]>();
    for (const feature of this.selectedFeatures()) {
      const list = groups.get(feature.category) ?? [];
      list.push(feature);
      groups.set(feature.category, list);
    }
    return Array.from(groups.entries());
  });

  readonly yearlyEquivalent = computed(() => Math.round(this.priceMonthly() * 12 * 0.9));

  readonly canSubmit = computed(() => {
    const validName = this.name().trim().length >= 2;
    const validPrice = this.priceMonthly() > 0;
    const validSeats = this.seatsIncluded() > 0;
    const validLocations = this.locationsIncluded() > 0;
    const hasFeatures = this.selectedFeatureIds().length > 0;
    return validName && validPrice && validSeats && validLocations && hasFeatures && !this.submitting();
  });

  isFeatureSelected(id: string): boolean {
    return this.selectedFeatureIds().includes(id);
  }

  toggleFeature(id: string): void {
    this.selectedFeatureIds.update((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  }

  selectCategoryFeatures(category: string, selected: boolean): void {
    const ids = this.data.features.filter((f) => f.category === category).map((f) => f.id);
    this.selectedFeatureIds.update((current) => {
      const set = new Set(current);
      for (const id of ids) {
        if (selected) set.add(id);
        else set.delete(id);
      }
      return Array.from(set);
    });
  }

  isCategoryFullySelected(category: string): boolean {
    const features = this.data.features.filter((f) => f.category === category);
    return features.length > 0 && features.every((f) => this.isFeatureSelected(f.id));
  }

  selectCoreFeatures(): void {
    this.selectedFeatureIds.set(this.data.features.filter((f) => !f.optional).map((f) => f.id));
  }

  selectAllFeatures(): void {
    this.selectedFeatureIds.set(this.data.features.map((f) => f.id));
  }

  clearFeatures(): void {
    this.selectedFeatureIds.set([]);
  }

  cancel(): void {
    void this.router.navigate(['/plans']);
  }

  submit(): void {
    if (!this.canSubmit()) {
      this.toast.error('Complete all required fields and select at least one feature.', 'Create failed');
      return;
    }
    this.submitting.set(true);
    const id = this.data.createPlan({
      name: this.name().trim(),
      priceMonthly: this.priceMonthly(),
      seatsIncluded: this.seatsIncluded(),
      locationsIncluded: this.locationsIncluded(),
      interval: this.interval(),
      status: this.status(),
      featureIds: this.selectedFeatureIds(),
      notes: this.notes().trim() || undefined,
    });
    this.submitting.set(false);
    if (id) void this.router.navigate(['/plans', id]);
  }

  setInterval(value: string): void {
    this.interval.set(value as PlanInterval);
  }

  setStatus(value: string): void {
    this.status.set(value as 'draft' | 'active');
  }
}
