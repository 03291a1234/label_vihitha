import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class Notify {
  private snack = inject(MatSnackBar);

  success(message: string) {
    this.snack.open(message, 'OK', { duration: 3000, panelClass: 'snack-success' });
  }

  error(err: unknown, fallback = 'Something went wrong') {
    this.snack.open(this.extract(err, fallback), 'Dismiss', { duration: 6000, panelClass: 'snack-error' });
  }

  private extract(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (body?.errors) {
        const first = Object.values(body.errors)[0];
        if (Array.isArray(first) && first.length) return String(first[0]);
      }
      if (typeof body?.title === 'string') return body.title;
      if (typeof body === 'string') return body;
      if (err.status === 0) return 'Cannot reach the API. Is it running?';
    }
    return fallback;
  }
}
