import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { HqDataService } from '../../core/services/hq-data.service';
import { PlatformSettings } from '../../core/models/hq.models';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';
import { HqPageTabs } from '../../shared/hq-page-tabs';
import { HqRequirePermissionDirective } from '../../shared/hq-require-permission.directive';
import { HqPermissionsService } from '../../core/services/hq-permissions.service';

@Component({
  selector: 'app-platform-page',
  imports: [DatePipe, HqSelect, HqRequirePermissionDirective, HqPageTabs],
  templateUrl: './platform-page.html',
  styleUrl: './platform-page.scss',
})
export class PlatformPage {
  readonly data = inject(HqDataService);
  readonly perms = inject(HqPermissionsService);
  readonly tab = signal<'settings' | 'flags' | 'integrations'>('settings');
  readonly draft = signal<PlatformSettings>({ ...this.data.platformSettings() });
  readonly saved = signal(false);

  readonly timezoneOptions: HqSelectOption[] = [
    { value: 'UTC', label: 'UTC' },
    { value: 'Europe/London', label: 'Europe/London' },
    { value: 'America/New_York', label: 'America/New_York' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai' },
  ];

  readonly localeOptions: HqSelectOption[] = [
    { value: 'en-GB', label: 'en-GB' },
    { value: 'en-US', label: 'en-US' },
    { value: 'en-AE', label: 'en-AE' },
  ];

  refreshDraft(): void {
    this.draft.set({ ...this.data.platformSettings() });
  }

  updateField<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]): void {
    this.draft.update((current) => ({ ...current, [key]: value }));
    this.saved.set(false);
  }

  saveSettings(): void {
    this.data.updatePlatformSettings(this.draft());
    this.saved.set(true);
  }

  toggleFlag(id: string): void {
    this.data.toggleFeatureFlag(id);
  }

  connect(integrationId: string): void {
    this.data.connectIntegration(integrationId);
  }

  setRollout(id: string, value: string, notify = false): void {
    const n = Number(value);
    if (Number.isNaN(n)) return;
    this.data.updateFeatureFlagRollout(id, n, { notify });
  }

  previewRollout(id: string, value: string): void {
    this.setRollout(id, value, false);
  }

  commitRollout(id: string, value: string): void {
    this.setRollout(id, value, true);
  }
}
