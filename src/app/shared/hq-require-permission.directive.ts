import { Directive, ElementRef, Renderer2, effect, inject, input } from '@angular/core';
import { PermissionCategoryKey, PermissionLevel } from '../core/models/hq.models';
import { HqPermissionsService } from '../core/services/hq-permissions.service';

/**
 * Hides or disables an element when the signed-in user lacks the required permission.
 * Reacts live when Super Admin edits the permission matrix.
 */
@Directive({
  selector: '[hqRequirePermission]',
})
export class HqRequirePermissionDirective {
  private readonly perms = inject(HqPermissionsService);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);

  readonly hqRequirePermission = input.required<PermissionCategoryKey>();
  readonly hqRequirePermissionMin = input<PermissionLevel>('write');
  readonly hqRequirePermissionMode = input<'hide' | 'disable'>('hide');

  constructor() {
    effect(() => {
      this.perms.currentPermissions();
      const category = this.hqRequirePermission();
      const min = this.hqRequirePermissionMin();
      const mode = this.hqRequirePermissionMode();
      const allowed = this.perms.meets(category, min);
      const node = this.el.nativeElement;

      if (mode === 'disable') {
        if (node instanceof HTMLButtonElement || node instanceof HTMLInputElement) {
          node.disabled = !allowed;
        } else {
          this.renderer.setProperty(node, 'aria-disabled', !allowed);
          this.renderer.setStyle(node, 'pointer-events', allowed ? null : 'none');
          this.renderer.setStyle(node, 'opacity', allowed ? null : '0.45');
        }
        return;
      }

      this.renderer.setStyle(node, 'display', allowed ? null : 'none');
    });
  }
}
