import { Routes } from '@angular/router';
import { ModerationPage } from './moderation';
export const routes: Routes = [{ path: '', component: ModerationPage }, { path: '**', redirectTo: '' }];
