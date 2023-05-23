import axios from "axios";
import dayjs from "dayjs";
import { ulid } from "ulid";
import { PaymentResponse } from "./type";
import { ENVS } from "../config/env";
import { Item } from "../db/item.entity";
import { utils } from "ethers";

export interface ImsafuOptions {
  url: string;
  api: string;
  apiSecret: string;
  receiver: string;
}

export class Imsafu {
  constructor(private readonly options: ImsafuOptions = ENVS.imsafu) {}

  newOrderID(): string {
    return utils.hexlify(Buffer.from(ulid().padEnd(32), "utf8"));
  }

  buildPaymentURL(item: Item, res: PaymentResponse): string {
    const urlSearchParams = new URLSearchParams();
    urlSearchParams.append("payID", res.payment.payID);
    urlSearchParams.append("brand", ENVS.merchant.brand);
    urlSearchParams.append("memo", item.name);
    urlSearchParams.append("redirect_url", ENVS.merchant.redirectURL);
    urlSearchParams.append("currency", "USD");
    const url = new URL(`${ENVS.imsafu.url}/payment_qrcode`);
    url.search = urlSearchParams.toString();
    return url.toString();
  }

  async createPayment(amount: number): Promise<PaymentResponse> {
    const deadline = dayjs().add(1, "day").toISOString();
    const payload = {
      payment: {
        orderID: this.newOrderID(),
        receiver: this.options.receiver,
        amount: amount.toString(),
        deadline,
      },
      notifyURL: `${this.options.url}/notify`,
    };

    const res = await axios.post(`${this.options.api}/depositPay`, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.options.apiSecret}`,
      },
    });

    return res.data;
  }

  async getPayment(payID: string): Promise<PaymentResponse> {
    const res = await axios.get<PaymentResponse>(
      `${this.options.api}/depositPays/${payID}`,
    );

    return res.data;
  }
}
