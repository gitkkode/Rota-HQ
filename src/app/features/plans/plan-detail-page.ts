import { DatePipe } from '@angular/common';
import { HqCurrencyPipe } from '../../shared/hq-currency.pipe';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Feature } from '../../core/models/hq.models';
import { HqDataService } from '../../core/services/hq-data.service';
import { HqBreadcrumbs } from '../../shared/hq-breadcrumbs';
import { HqRequirePermissionDirective } from '../../shared/hq-require-permission.directive';

@Component({
  selector: 'app-plan-detail-page',
  imports: [RouterLink, HqCurrencyPipe, DatePipe, HqBreadcrumbs, HqRequirePermissionDirective],
  templateUrl: './plan-detail-page.html',
  styleUrl: './plan-detail-page.scss',
})
export class PlanDetailPage {
  readonly data = inject(HqDataService);
  private readonly route = inject(ActivatedRoute);

  private readonly planId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );

  readonly plan = computed(() => this.data.getPlan(this.planId()));
  readonly features = computed(() => {
    const plan = this.plan();
    if (!plan) return [];
    return this.data.features.filter((f) => plan.featureIds.includes(f.id));
  });
  readonly addOnFeatures = computed(() => {
    const plan = this.plan();
    if (!plan?.addOnFeatureIds?.length) return [];
    return this.data.features.filter((f) => plan.addOnFeatureIds!.includes(f.id));
  });
  readonly subscribers = computed(() => this.data.getOrgsOnPlan(this.planId()));
  readonly planChanges = computed(() => this.data.getPlanChangesForPlan(this.planId()));
  readonly breadcrumb = computed(() => [
    { label: 'Plans', link: '/plans' },
    { label: this.plan()?.name ?? 'Plan detail' },
  ]);
  readonly featuresByCategory = computed(() => {
    const groups = new Map<string, Feature[]>();
    for (const feature of this.features()) {
      const list = groups.get(feature.category) ?? [];
      list.push(feature);
      groups.set(feature.category, list);
    }
    return Array.from(groups.entries());
  });
}
