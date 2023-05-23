export interface Payment {
  payID: string;
  orderID: string;
  receiver: string;
  amount: string;
  originalAmount: string;
  maxFeeAmount: string;
  deadline: string;
}

export interface Chain {
  id: number;
  symbol: string;
  name: string;
}

export interface Token {
  symbol: string;
  address: string;
}

export interface ReceiveTx {
  chain: Chain;
  txID: string;
  confirmedAt: string;
  amount: string;
  feeAmount: string;
  token: Token;
}

export interface Deposit {
  chainID: number;
  token: string;
}

export interface PaymentResponse {
  status: string;
  payment: Payment;
  owner: string;
  depositAddress: string;
  callID: number;
  receiveTx: ReceiveTx | null;
  deposits: Deposit[] | null;
}
