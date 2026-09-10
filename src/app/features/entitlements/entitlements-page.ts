import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HqDataService } from '../../core/services/hq-data.service';
import { HqPageTabs } from '../../shared/hq-page-tabs';
import { HqEmptyState } from '../../shared/hq-empty-state';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';
import { HqRequirePermissionDirective } from '../../shared/hq-require-permission.directive';

@Component({
  selector: 'app-entitlements-page',
  imports: [RouterLink, DatePipe, HqSelect, HqEmptyState, HqRequirePermissionDirective, HqPageTabs],
  templateUrl: './entitlements-page.html',
  styleUrl: './entitlements-page.scss',
})
export class EntitlementsPage {
  readonly data = inject(HqDataService);
  readonly orgFilter = signal('all');
  readonly search = signal('');
  readonly tab = signal<'overview' | 'activity'>('overview');
  readonly selectedOrgId = signal<string | null>(null);

  readonly orgOptions = computed<HqSelectOption[]>(() => [
    { value: 'all', label: 'All organizations' },
    ...this.data.organizations().map((o) => ({ value: o.id, label: o.name })),
  ]);

  readonly rows = computed(() => {
    const orgId = this.orgFilter();
    const q = this.search().trim().toLowerCase();
    const orgs =
      orgId === 'all' ? this.data.organizations() : this.data.organizations().filter((o) => o.id === orgId);
    return orgs
      .filter((org) => !q || org.name.toLowerCase().includes(q))
      .map((org) => {
        const effective = this.data.getEffectiveFeaturesForOrg(org.id);
        const enabled = effective.filter((r) => r.enabled).length;
        const overrides = effective.filter((r) => r.source === 'override').length;
        const ratio = enabled / (this.data.features.length || 1);
        return { org, enabled, overrides, total: this.data.features.length, effective, ratio };
      });
  });

  readonly summary = computed(() => {
    const rows = this.rows();
    const withOverrides = rows.filter((r) => r.overrides > 0).length;
    const totalOverrides = rows.reduce((s, r) => s + r.overrides, 0);
    return {
      organizations: rows.length,
      withOverrides,
      totalOverrides,
      featureCatalogue: this.data.features.length,
    };
  });

  readonly entitlementActivity = this.data.entitlementActivity;

  readonly selectedRow = computed(() => {
    const id = this.selectedOrgId();
    return this.rows().find((r) => r.org.id === id) ?? null;
  });

  openDetail(orgId: string): void {
    this.selectedOrgId.set(orgId);
  }

  closeDetail(): void {
    this.selectedOrgId.set(null);
  }

  meterTone(ratio: number): 'near' | 'limit' | null {
    if (ratio >= 1) return 'limit';
    if (ratio >= 0.85) return 'near';
    return null;
  }
}
