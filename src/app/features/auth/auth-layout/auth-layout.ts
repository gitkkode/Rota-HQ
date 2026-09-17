import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { HqIcon } from '../../../shared/hq-icon';
import { HqToastContainer } from '../../../shared/hq-toast-container';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, RouterLink, HqIcon, HqToastContainer],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
})
export class AuthLayout {}
