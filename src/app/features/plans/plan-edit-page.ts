import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HqDataService } from '../../core/services/hq-data.service';
import { HqBreadcrumbs } from '../../shared/hq-breadcrumbs';

@Component({
  selector: 'app-plan-edit-page',
  imports: [RouterLink, HqBreadcrumbs],
  templateUrl: './plan-edit-page.html',
  styleUrl: './plan-edit-page.scss',
})
export class PlanEditPage {
  readonly data = inject(HqDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly planId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );

  readonly plan = computed(() => this.data.getPlan(this.planId()));
  readonly name = signal('');
  readonly price = signal(0);
  readonly seats = signal(0);
  readonly locations = signal(0);

  readonly breadcrumb = computed(() => [
    { label: 'Plans & Features', link: '/plans' },
    { label: this.plan()?.name ?? 'Edit plan' },
  ]);

  constructor() {
    effect(() => {
      const p = this.plan();
      if (!p) return;
      this.name.set(p.name);
      this.price.set(p.priceMonthly);
      this.seats.set(p.seatsIncluded);
      this.locations.set(p.locationsIncluded);
    });
  }

  save(): void {
    const id = this.planId();
    if (!id) return;
    this.data.updatePlan(id, {
      name: this.name().trim(),
      priceMonthly: this.price(),
      seatsIncluded: this.seats(),
      locationsIncluded: this.locations(),
    });
    void this.router.navigate(['/plans', id]);
  }

  retire(): void {
    const id = this.planId();
    if (!id) return;
    this.data.retirePlan(id);
    void this.router.navigate(['/plans']);
  }
}
