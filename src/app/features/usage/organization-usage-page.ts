import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HqDataService } from '../../core/services/hq-data.service';
import { HqBreadcrumbs } from '../../shared/hq-breadcrumbs';

@Component({
  selector: 'app-organization-usage-page',
  imports: [RouterLink, HqBreadcrumbs, DecimalPipe],
  templateUrl: './organization-usage-page.html',
  styleUrl: './organization-usage-page.scss',
})
export class OrganizationUsagePage {
  readonly data = inject(HqDataService);
  private readonly route = inject(ActivatedRoute);

  private readonly orgId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('orgId') ?? '')),
    { initialValue: '' },
  );

  readonly org = computed(() => this.data.getOrganization(this.orgId()));
  readonly detail = computed(() =>
    this.orgId() ? this.data.getOrgUsageDetail(this.orgId()) : null,
  );
  readonly breadcrumb = computed(() => [
    { label: 'Usage', link: '/usage' },
    { label: this.org()?.name ?? 'Organization usage' },
  ]);
}
