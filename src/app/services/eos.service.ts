import * as Eos from 'eosjs';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, from, of, timer, defer, combineLatest } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { Transaction, Result } from '../models';
import { LoggerService } from './logger.service';

@Injectable()
export class EosService {
  public eos: any;

  constructor(
    private http: HttpClient,
    private logger: LoggerService
  ) {
    this.eos = Eos({
      httpEndpoint: environment.blockchainUrl,
      blockId: environment.chainId
    });
  }

  // Note: to convert chain promise to cold observable, use defer

  private getResult<T>(source$: Observable<T>): Observable<Result<T>> {
    return source$.pipe(
      map(data => {
        return {
          isError: false,
          value: data
        };
      }),
      catchError(error => {
        this.logger.error('CHAIN_ERROR', error);
        return of({
          isError: true,
          value: error
        });
      })
    );
  }

  getDeferInfo(): Observable<any> {
    return defer(() => from(this.eos.getInfo({})));
  }

  getDeferBlock(id: string | number): Observable<any> {
    return defer(() => from(this.eos.getBlock(id)));
  }

  getAccount(name: string): Observable<any> {
    return from(this.eos.getAccount(name));
  }

  getAccountRaw(name: string): Observable<Result<any>> {
    const getAccount$ = defer(() => from(this.eos.getAccount(name)));
    return this.getResult<any>(getAccount$);
  }

  getAccountActions(name: string, position = -1, offset = -20): Observable<Result<any[]>> {
    const getAccountActions$ = defer(() => from(this.eos.getActions({
      account_name: name,
      pos: position,
      offset: offset
    })));
    return this.getResult<any[]>(getAccountActions$.pipe(
      map((data: any) => data.actions),
      map((actions: any[]) => actions.sort((a, b) => b.account_action_seq - a.account_action_seq))
    ));
  }

  getAccountTokens(name: string): Observable<Result<any[]>> {
    const allTokens$: Observable<any[]> = this.http.get<any[]>(`https://raw.githubusercontent.com/eoscafe/eos-airdrops/master/tokens.json`);
    const getCurrencyBalance = function (token: any, account: string): Observable<any> {
      return from(this.eos.getCurrencyBalance(token.account, account, token.symbol)).pipe(
        map((balance: string[]) => ({
          ...token,
          balance: balance[0] ? Number(balance[0].split(' ', 1)) : 0
        })),
        catchError(() => of({
          ...token,
          balance: 0
        }))
      );
    };
    const accountTokens$ = allTokens$.pipe(
      switchMap(tokens => {
        return combineLatest(
          tokens.map(token => getCurrencyBalance.bind(this)(token, name))
        ).pipe(
          map(tokens => tokens.filter(token => token.balance > 0))
        )
      })
    );
    return this.getResult<any[]>(accountTokens$);
  }

  getAbi(name: string): Observable<Result<any>> {
    const getCode$ = defer(() => from(this.eos.getAbi({
      account_name: name
    })));
    return this.getResult<any>(getCode$);
  }

  getBlockRaw(id: string | number): Observable<Result<any>> {
    const getBlock$ = defer(() => from(this.eos.getBlock(id)));
    return this.getResult<any>(getBlock$);
  }

  getTransactionRaw(blockId: number, id: string): Observable<Result<any>> {
    const getTransaction$ = defer(() => from(this.eos.getTransaction({
      id: id,
      block_num_hint: blockId
    })));
    return this.getResult<any>(getTransaction$);
  }

  getTransaction(id: string): Observable<Result<Transaction>> {
    return from(this.eos.getTransaction({ id })).pipe(
      map((transaction: any) => {
        return <Result<Transaction>>{
          isError: false,
          value: {
            blockId: transaction.block_num,
            createdAt: new Date(transaction.block_time).getTime() / 1000,
            expiration: new Date(transaction.trx.trx.expiration).getTime() / 1000,
            id: transaction.id,
            numActions: transaction.trx.trx.actions.length,
            pending: transaction.trx.trx.delay_sec > 0,
            updatedAt: new Date(transaction.block_time).getTime() / 1000
          }
        };
      }),
      catchError(error => {
        console.log('TODO: Log Chain Error', error);
        return of({
          isError: true,
          value: error
        });
      })
    );
  }

  getTransactionHistory(id: string, blockNumber: number): Observable<any> {
    return from(this.eos.getTransaction({
      id: id,
      block_num_hint: blockNumber
    }));
  }

  getCurrencyBalance(name: string): Observable<number> {
    return from(this.eos.getCurrencyBalance('eosio.token', name, 'EOS')).pipe(
      map(result => {
        if (result && result[0]) {
          return parseFloat(result[0].replace(' EOS', ''));
        }
        return 0;
      })
    );
  }

  getRamPrice(): Observable<number> {
    return from(this.eos.getTableRows({
      json: true,
      code: "eosio",
      scope: "eosio",
      table: "rammarket",
      limit: 1
    })).pipe(
      map((result: any) => {
        let base = parseFloat(result.rows[0].base.balance.replace(' RAM', ''));
        let quote = parseFloat(result.rows[0].quote.balance.replace(' EOS', ''));
        return quote / base;
      })
    );
  }

  getProducers() {
    return from(this.eos.getTableRows({
      json: true,
      code: "eosio",
      scope: "eosio",
      table: "producers",
      limit: 700,
      table_key: ""
    })).pipe(
      map((result: any) => {
        return result.rows
          .map(row => ({ ...row, total_votes: parseFloat(row.total_votes) }))
          .sort((a, b) => b.total_votes - a.total_votes);
      })
    );
  }

  getChainStatus() {
    return from(this.eos.getTableRows({
      json: true,
      code: "eosio",
      scope: "eosio",
      table: "global",
      limit: 1
    })).pipe(
      map((result: any) => result.rows[0])
    );
  }
}
