import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Result, Transaction } from '../models';
import { LoggerService } from './logger.service';
import * as moment from 'moment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(
    private http: HttpClient,
    private logger: LoggerService
  ) { }

  getBlockTransactions(id: number, page = 1, size = 30): Observable<Result<Transaction[]>> {
    return this.http.get(`${environment.apiUrl}/blocks/${id}/transactions?page=${page}&size=${size}`).pipe(
      map((transactions: any[]) => {
        return <Result<Transaction[]>>{
          isError: false,
          value: transactions.map(transaction => {
            return <Transaction>{
              ...transaction,
              createdAt: transaction.createdAt - 7200,
              createdAtISO: moment.unix(transaction.createdAt - 7200).toISOString(),
              expiration: transaction.expiration - 7200,
              expirationISO: moment.unix(transaction.expiration - 7200).toISOString(),
              updatedAt: transaction.updatedAt - 7200,
              updatedAtISO: moment.unix(transaction.updatedAt - 7200).toISOString()
            };
          })
        }
      }),
      catchError(error => {
        this.logger.error('API_ERROR', error);
        return of({
          isError: true,
          value: error
        });
      })
    );
  }

}
