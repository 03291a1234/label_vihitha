import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResponse } from './models';

const TOKEN_KEY = 'lv_m_token';
const USER_KEY = 'lv_m_user';

interface StoredUser { userName: string; roles: string[]; expiresAtUtc: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private _user = signal<StoredUser | null>(this.read());

  readonly userName = computed(() => this._user()?.userName ?? '');
  readonly roles = computed(() => this._user()?.roles ?? []);
  readonly isOwner = computed(() => this.roles().includes('Owner'));

  isLoggedIn(): boolean {
    const u = this._user();
    return !!u && new Date(u.expiresAtUtc).getTime() > Date.now();
  }

  get token(): string | null { return localStorage.getItem(TOKEN_KEY); }

  login(userName: string, password: string) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, { userName, password }).pipe(
      tap(res => {
        localStorage.setItem(TOKEN_KEY, res.accessToken);
        const u: StoredUser = { userName: res.userName, roles: res.roles, expiresAtUtc: res.expiresAtUtc };
        localStorage.setItem(USER_KEY, JSON.stringify(u));
        this._user.set(u);
      })
    );
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private read(): StoredUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}
