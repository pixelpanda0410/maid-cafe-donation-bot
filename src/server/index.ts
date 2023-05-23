import express, { Express, Request, Response } from "express";
import { DB } from "../db";
import { Imsafu } from "../imsafu";
import { ENVS } from "../config/env";
import morgan from "morgan";
import { TGBot } from "./tg-bot";
import bodyParser from "body-parser";

export class Server {
  private app: Express;
  private db: DB;
  private imsafu: Imsafu;
  private bot: TGBot;

  constructor() {
    this.app = express();
    this.db = DB.connect();
    this.imsafu = new Imsafu(ENVS.imsafu);
    this.bot = new TGBot(this.db, this.imsafu);
  }

  private async initExpressServer() {
    this.app
      .use(morgan("combined"))
      .use(await this.bot.createWebhook())
      .use(bodyParser.json());

    this.app.post("/notify", this.processNotify);
  }

  private processNotify = async (req: Request, res: Response) => {
    try {
      const { payID } = req.body;
      const savedPayment = await this.db.payment.findOne({
        where: {
          payID,
        },
      });
      if (!savedPayment) {
        console.log(`payID: ${payID} is invalid.`);
        // drop invalid payID
        return res
          .status(200)
          .json({ error: `payID: ${payID} is invalid` })
          .end();
      }
      const payment = await this.imsafu.getPayment(payID);
      if (!payment) {
        console.log(`payment: ${payID} is not exist in imsafu.`);
        return res.status(200).end();
      }
      if (savedPayment.status !== payment.status) {
        savedPayment.status = payment.status;
        savedPayment.callID = payment.callID;
        savedPayment.owner = payment.owner;
        savedPayment.depositAddress = payment.depositAddress;
        savedPayment.receiveTxID = payment.receiveTx?.txID;
        savedPayment.receiveChainID = payment.receiveTx?.chain?.id;
        savedPayment.receiveChainName = payment.receiveTx?.chain?.name;
        savedPayment.receiveTokenSymbol = payment.receiveTx?.token?.symbol;
        savedPayment.receiveTokenAddress = payment.receiveTx?.token?.address;
        await this.db.payment.save(savedPayment);
      }
      await this.bot.notifyPaymentStatus(savedPayment);

      return res.status(200).end();
    } catch (e) {
      // get error when get payment from imsafu, wait for next notify
      return res.status(500).end();
    }
  };

  private defaultStartCallback() {
    console.log(`listening at: ${ENVS.server.port}`);
  }

  async init() {
    await this.db.init();
    await this.initExpressServer();
    this.bot.initTGBotActions();
  }

  async up() {
    this.app.listen(ENVS.server.port, "0.0.0.0", this.defaultStartCallback);
    await this.bot.launch();
  }
}
