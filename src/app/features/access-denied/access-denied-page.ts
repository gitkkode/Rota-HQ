import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HqPermissionsService } from '../../core/services/hq-permissions.service';
import { HqBreadcrumbs } from '../../shared/hq-breadcrumbs';

@Component({
  selector: 'app-access-denied-page',
  imports: [RouterLink, HqBreadcrumbs],
  templateUrl: './access-denied-page.html',
  styleUrl: './access-denied-page.scss',
})
export class AccessDeniedPage {
  readonly perms = inject(HqPermissionsService);
  readonly breadcrumb = [{ label: 'Access denied' }];
}
