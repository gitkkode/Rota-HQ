import { HqCurrencyPipe } from '../../shared/hq-currency.pipe';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';import { formatHqCurrency } from '../../core/constants/currency.constants';
import { HqDataService } from '../../core/services/hq-data.service';
import { OrgStatus, PlanInterval } from '../../core/models/hq.models';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';

@Component({
  selector: 'app-organization-create-page',
  imports: [HqCurrencyPipe, HqSelect],
  templateUrl: './organization-create-page.html',
  styleUrl: './organization-create-page.scss',
})
export class OrganizationCreatePage {
  readonly data = inject(HqDataService);
  private readonly router = inject(Router);

  readonly name = signal('');
  readonly slug = signal('');
  readonly slugTouched = signal(false);
  readonly industry = signal('Healthcare');
  readonly country = signal('United Kingdom');
  readonly planId = signal('plan-starter');
  readonly status = signal<OrgStatus>('trial');
  readonly interval = signal<PlanInterval>('monthly');
  readonly seats = signal(50);
  readonly locationCount = signal(1);
  readonly usersLimit = signal(50);
  readonly locationsLimit = signal(2);
  readonly managersLimit = signal(8);
  readonly storageLimitGb = signal(50);
  readonly adminName = signal('');
  readonly adminEmail = signal('');
  readonly adminRole = signal('Customer Admin');
  readonly notes = signal('');
  readonly submitting = signal(false);
  readonly step = signal(1);
  readonly stepDirection = signal<'forward' | 'back'>('forward');
  readonly totalSteps = 4;

  readonly stepLabels = ['Company', 'Plan', 'Admin', 'Review'];

  readonly industryOptions: HqSelectOption[] = [
    { value: 'Healthcare', label: 'Healthcare' },
    { value: 'Retail', label: 'Retail' },
    { value: 'Hospitality', label: 'Hospitality' },
    { value: 'Logistics', label: 'Logistics' },
    { value: 'Security', label: 'Security' },
    { value: 'Technology', label: 'Technology' },
    { value: 'Education', label: 'Education' },
    { value: 'Manufacturing', label: 'Manufacturing' },
    { value: 'Professional Services', label: 'Professional Services' },
    { value: 'Other', label: 'Other' },
  ];

  readonly countryOptions: HqSelectOption[] = [
    { value: 'United Kingdom', label: 'United Kingdom' },
    { value: 'Ireland', label: 'Ireland' },
    { value: 'United States', label: 'United States' },
    { value: 'Netherlands', label: 'Netherlands' },
    { value: 'Germany', label: 'Germany' },
    { value: 'France', label: 'France' },
    { value: 'United Arab Emirates', label: 'United Arab Emirates' },
    { value: 'Australia', label: 'Australia' },
  ];

  readonly planOptions = computed<HqSelectOption[]>(() =>
    this.data.plans().map((plan) => ({
      value: plan.id,
      label: `${plan.name} · ${formatHqCurrency(plan.priceMonthly)}/mo`,
    })),
  );

  readonly statusOptions: HqSelectOption[] = [
    { value: 'trial', label: 'Trial' },
    { value: 'active', label: 'Active (bill immediately)' },
  ];

  readonly intervalOptions: HqSelectOption[] = [
    { value: 'monthly', label: 'Monthly billing' },
    { value: 'yearly', label: 'Yearly billing' },
  ];

  readonly adminRoleOptions: HqSelectOption[] = [
    { value: 'Customer Admin', label: 'Customer Admin' },
    { value: 'Billing Admin', label: 'Billing Admin' },
    { value: 'Operations Admin', label: 'Operations Admin' },
  ];

  readonly selectedPlan = computed(() => this.data.getPlan(this.planId()));

  readonly planFeatures = computed(() => {
    const plan = this.selectedPlan();
    if (!plan) return [];
    return this.data.features.filter((f) => plan.featureIds.includes(f.id));
  });

  readonly previewInitials = computed(() =>
    this.name()
      .trim()
      .split(/\s+/)
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'OR',
  );

  readonly canSubmit = computed(() => {
    const hasOrg = this.name().trim().length >= 2 && this.industry() && this.country();
    const hasAdmin = this.adminName().trim().length >= 2 && this.adminEmail().includes('@');
    return hasOrg && hasAdmin && !this.submitting();
  });

  readonly canAdvance = computed(() => this.isStepValid(this.step()));

  readonly progressPercent = computed(() => ((this.step() - 1) / (this.totalSteps - 1)) * 100);

  readonly isLastStep = computed(() => this.step() === this.totalSteps);

  constructor() {
    this.setPlan(this.planId());
  }

  onNameInput(value: string): void {
    this.name.set(value);
    if (!this.slugTouched()) {
      this.slug.set(this.slugify(value));
    }
  }

  onSlugInput(value: string): void {
    this.slugTouched.set(true);
    this.slug.set(this.slugify(value));
  }

  setPlan(planId: string): void {
    this.planId.set(planId);
    const plan = this.data.getPlan(planId);
    if (!plan) return;
    this.seats.set(plan.seatsIncluded);
    this.usersLimit.set(plan.seatsIncluded);
    this.locationsLimit.set(plan.locationsIncluded);
    this.managersLimit.set(Math.max(5, Math.floor(plan.seatsIncluded / 10)));
    this.storageLimitGb.set(
      plan.id === 'plan-enterprise' ? 200 : plan.id === 'plan-growth' ? 100 : 50,
    );
    if (this.locationCount() > plan.locationsIncluded) {
      this.locationCount.set(plan.locationsIncluded);
    }
  }

  cancel(): void {
    void this.router.navigate(['/organizations']);
  }

  nextStep(): void {
    if (!this.canAdvance() || this.step() >= this.totalSteps) return;
    this.stepDirection.set('forward');
    this.step.update((s) => s + 1);
  }

  prevStep(): void {
    if (this.step() <= 1) return;
    this.stepDirection.set('back');
    this.step.update((s) => s - 1);
  }

  goToStep(n: number): void {
    if (!this.canGoToStep(n)) return;
    this.stepDirection.set(n > this.step() ? 'forward' : 'back');
    this.step.set(n);
  }

  canGoToStep(n: number): boolean {
    if (n < 1 || n > this.totalSteps) return false;
    if (n <= this.step()) return true;
    for (let s = 1; s < n; s++) {
      if (!this.isStepValid(s)) return false;
    }
    return true;
  }

  isStepValid(stepNumber: number): boolean {
    if (stepNumber === 1) {
      return this.name().trim().length >= 2 && !!this.industry() && !!this.country();
    }
    if (stepNumber === 2) return !!this.selectedPlan();
    if (stepNumber === 3) {
      return this.adminName().trim().length >= 2 && this.adminEmail().includes('@');
    }
    if (stepNumber === 4) return !!this.canSubmit();
    return false;
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    const id = this.data.createOrganization({
      name: this.name().trim(),
      slug: this.slug().trim(),
      industry: this.industry(),
      country: this.country(),
      planId: this.planId(),
      status: this.status(),
      interval: this.interval(),
      seats: this.seats(),
      locationCount: this.locationCount(),
      usageLimits: {
        usersLimit: this.usersLimit(),
        locationsLimit: this.locationsLimit(),
        managersLimit: this.managersLimit(),
        storageLimitGb: this.storageLimitGb(),
      },
      primaryAdmin: {
        name: this.adminName().trim(),
        email: this.adminEmail().trim(),
        role: this.adminRole(),
      },
      notes: this.notes().trim() || undefined,
    });
    this.submitting.set(false);
    if (id) void this.router.navigate(['/organizations', id]);
  }

  setStatus(value: string): void {
    this.status.set(value as OrgStatus);
  }

  setInterval(value: string): void {
    this.interval.set(value as PlanInterval);
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
