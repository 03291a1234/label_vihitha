import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse } from '../models';

const TOKEN_KEY = 'lv_token';
const USER_KEY = 'lv_user';

interface StoredUser {
  userName: string;
  roles: string[];
  expiresAtUtc: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<StoredUser | null>(this.readUser());

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null && !this.isExpired());
  readonly userName = computed(() => this._user()?.userName ?? '');
  readonly roles = computed(() => this._user()?.roles ?? []);
  readonly isOwner = computed(() => this.roles().includes('Owner'));
  readonly canManage = computed(() => this.roles().some(r => r === 'Owner' || r === 'Staff'));

  constructor(private http: HttpClient, private router: Router) {}

  login(userName: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, { userName, password }).pipe(
      tap(res => {
        localStorage.setItem(TOKEN_KEY, res.accessToken);
        const user: StoredUser = { userName: res.userName, roles: res.roles, expiresAtUtc: res.expiresAtUtc };
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        this._user.set(user);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private isExpired(): boolean {
    const u = this._user();
    if (!u) return true;
    return new Date(u.expiresAtUtc).getTime() <= Date.now();
  }

  private readUser(): StoredUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as StoredUser) : null;
    } catch {
      return null;
    }
  }
}
