import { chunk } from "lodash";
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
    return Markup.inlineKeyboard([Markup.button.callback("展示商品", "list")]);
  }

  private listProducts = async (ctx: ActionContext) => {
    const items = await this.db.item.find();
    const chunkItems = chunk(items, 1);
    return ctx.reply(
      "请选择:",
      Markup.inlineKeyboard(
        chunkItems.map((subItems) =>
          subItems.map((item) =>
            Markup.button.callback(
              `${item.name}-${item.description}: $${item.price}`,
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
      await ctx.sendMessage("正在创建订单...");
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
        `订单创建成功.`,
        Markup.inlineKeyboard([Markup.button.webApp("请点击按钮", paymentURL)]),
      );
    } catch (e) {
      console.log(e);
      return ctx.reply(`哇奥，报错了: ${e}`);
    }
  };

  notifyPaymentStatus = async (payment: Payment) => {
    let message = `订单状态更新: ${payment.status}`;
    let extra;
    if (payment.status === "success") {
      message = `捐赠成功. txID: ${payment.receiveTxID}`;
      extra = Markup.inlineKeyboard([
        Markup.button.callback("continue shopping", "list"),
      ]);
    }
    await this.bot.telegram.sendMessage(payment.chatID, message, extra);
  };

  initTGBotActions(): TGBot {
    this.bot.start((ctx) =>
      ctx.reply(`欢迎来到 ${ENVS.merchant.brand}`, this.firstLevelButtons),
    );

    this.bot.action("list", this.listProducts);
    this.bot.action(/buy_(\d+)/, this.createPayment);
    return this;
  }

  async launch() {
    return this.bot.launch();
  }
}
