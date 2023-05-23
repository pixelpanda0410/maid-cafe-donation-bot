import { chunk } from "lodash";
import morgan from "morgan";
import bodyParser from "body-parser";
import { Context, Markup, NarrowedContext, Telegraf } from "telegraf";
import hpa from "https-proxy-agent";
import { ENVS } from "../config/env";
import { CallbackQuery, Update } from "telegraf/typings/core/types/typegram";
import { DB } from "../db";
import { Imsafu } from "../imsafu";
import dayjs from "dayjs";
import { Payment } from "../db/payment.entity";

type ActionContext = NarrowedContext<
  Context<Update> & {
    match: RegExpExecArray;
  },
  Update.CallbackQueryUpdate<CallbackQuery>
>;

export class TGBot {
  private bot: Telegraf<Context<Update>>;

  constructor(private readonly db: DB, private readonly imsafu: Imsafu) {
    const agent = process.env.http_proxy
      ? new hpa.HttpsProxyAgent(process.env.http_proxy)
      : undefined;

    this.bot = new Telegraf(ENVS.server.botToken, {
      telegram: {
        agent,
      },
    });
  }

  async createWebhook() {
    return this.bot.createWebhook({ domain: ENVS.server.webhookDomain });
  }

  private get firstLevelButtons() {
    return Markup.inlineKeyboard([
      Markup.button.callback("list products", "list"),
    ]);
  }

  private listProducts = async (ctx: ActionContext) => {
    const items = await this.db.item.find();
    const chunkItems = chunk(items, 2);
    return ctx.reply(
      "products:",
      Markup.inlineKeyboard(
        chunkItems.map((subItems) =>
          subItems.map((item) =>
            Markup.button.callback(
              `${item.name} - $${item.price}`,
              `buy_${item.id}`,
            ),
          ),
        ),
      ),
    );
  };

  private createPayment = async (ctx: ActionContext) => {
    try {
      const itemID = parseInt(ctx.match[1]);
      const item = await this.db.item.findOne({ where: { id: itemID } });
      const chatID = ctx.from?.id;
      if (!chatID || !item) {
        return;
      }
      await ctx.sendMessage("creating payment...");
      const res = await this.imsafu.createPayment(item.price);

      const payment = {
        status: "pending",
        callID: res.callID,
        payID: res.payment.payID,
        orderID: res.payment.orderID,
        receiver: res.payment.receiver,
        amount: res.payment.amount,
        originalAmount: res.payment.originalAmount,
        maxFeeAmount: res.payment.maxFeeAmount,
        deadline: dayjs(res.payment.deadline).toDate(),
        chatID,
      };
      await this.db.payment.save(payment);

      const paymentURL = this.imsafu.buildPaymentURL(item, res);

      return ctx.reply(
        `payment created.`,
        Markup.inlineKeyboard([
          Markup.button.webApp("Click to pay", paymentURL),
        ]),
      );
    } catch (e) {
      console.log(e);
      return ctx.reply(`something wrong, please contact with admin: ${e}`);
    }
  };

  notifyPaymentStatus = async (payment: Payment) => {
    let message = `payment status changed: ${payment.status}`;
    let extra;
    if (payment.status === "success") {
      message = `payment success. transaction: ${payment.receiveTxID}`;
      extra = Markup.inlineKeyboard([
        Markup.button.callback("continue shopping", "list"),
      ]);
    }
    await this.bot.telegram.sendMessage(payment.chatID, message, extra);
  };

  initTGBotActions(): TGBot {
    this.bot.start((ctx) =>
      ctx.reply(`Welcome to ${ENVS.merchant.brand}`, this.firstLevelButtons),
    );
    this.bot.help((ctx) => ctx.reply("Send me a sticker"));

    this.bot.action("list", this.listProducts);
    this.bot.action(/buy_(\d+)/, this.createPayment);
    return this;
  }

  async launch() {
    return this.bot.launch();
  }
}
