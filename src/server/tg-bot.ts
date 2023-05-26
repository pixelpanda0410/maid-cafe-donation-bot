import { chunk } from "lodash";
import { Context, Markup, NarrowedContext, Telegraf } from "telegraf";
import hpa from "https-proxy-agent";
import { ENVS } from "../config/env";
import { CallbackQuery, Update } from "telegraf/typings/core/types/typegram";
import { DB } from "../db";
import { Imsafu } from "../imsafu";
import dayjs from "dayjs";
import { Payment } from "../db/payment.entity";
import path from "node:path";
import { randomWaitress } from "../assets/characters";
import { OpenAIClient } from "../openai";

type ActionContext = NarrowedContext<
  Context<Update> & {
    match: RegExpExecArray;
  },
  Update.CallbackQueryUpdate<CallbackQuery>
>;

interface CoffeeTaste {
  temperature: number;
  sweet: number;
  roast: number;
}

export class TGBot {
  private bot: Telegraf<Context<Update>>;
  private cache: Map<number, CoffeeTaste> = new Map();
  private openAIClient = new OpenAIClient();

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

  async launch() {
    return this.bot.launch();
  }

  private listCoffee = async (ctx: ActionContext) => {
    return ctx.reply(
      "选择您想要的口味，别忘了点“决定了”哦！",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("热的", "set_temperature_1"),
          Markup.button.callback("冰的", "set_temperature_0"),
        ],
        [
          Markup.button.callback("加糖", "set_sweet_1"),
          Markup.button.callback("无糖", "set_sweet_0"),
        ],
        [
          Markup.button.callback("苦味", "set_roast_1"),
          Markup.button.callback("酸味", "set_roast_0"),
        ],
        [Markup.button.callback("决定了", "get_coffee")],
      ]),
    );
  };

  private setCoffeeTaste = async (ctx: ActionContext) => {
    const chatID = ctx.from?.id;
    if (!chatID) {
      return;
    }
    let coffeeTaste = this.cache.get(chatID);
    if (!coffeeTaste) {
      coffeeTaste = {
        temperature: -1,
        sweet: -1,
        roast: -1,
      };
    }
    const [taste, value] = ctx.match[1].split("_");
    coffeeTaste[taste as keyof CoffeeTaste] = parseInt(value);

    this.cache.set(chatID, coffeeTaste);
  };

  private formatCoffeeTaste = (coffeeTaste: CoffeeTaste) => {
    const temperature = coffeeTaste.temperature === 1 ? "温暖的" : "凉爽的";
    const sweet = coffeeTaste.sweet === 1 ? "甜的" : "不甜的";
    const roast = coffeeTaste.roast === 1 ? "偏向苦味" : "偏向酸味";
    return `${temperature}，${sweet}，${roast}`;
  };

  private getCoffee = async (ctx: ActionContext) => {
    const chatID = ctx.from?.id;
    if (!chatID) {
      return;
    }
    const message = this.formatCoffeeTaste(this.cache.get(chatID)!);
    const reply = await this.openAIClient.getCoffeeTaste(chatID, message);

    return ctx.replyWithPhoto(
      {
        source: path.resolve(__dirname, "../assets/coffee/latte.png"),
      },
      {
        caption: `*${reply}*`,
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [[Markup.button.callback("为咖啡店捐款", "donate")]],
        },
      },
    );
  };

  private customDrink = async (ctx: ActionContext) => {};

  private donate = async (ctx: ActionContext) => {
    const items = await this.db.item.find();
    const chunkItems = chunk(items, 1);
    return ctx.reply(
      "感谢您的捐赠:",
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

  initTGBotActions(): TGBot {
    this.bot.start(async (ctx) => {
      const waitress = randomWaitress();
      const chatID = ctx.from?.id;
      if (!chatID) {
        return;
      }
      const greeting = await this.openAIClient.getGreetingMessage(
        chatID,
        waitress,
      );
      return ctx.replyWithPhoto(
        {
          source: path.resolve(
            __dirname,
            `../assets/characters/${waitress.name.toLowerCase()}/avatar.png`,
          ),
        },
        {
          caption: `*${greeting}*`,
          parse_mode: "MarkdownV2",
          reply_markup: {
            inline_keyboard: [[Markup.button.callback("咖啡", "list_coffee")]],
          },
        },
      );
    });

    this.bot.action("list_coffee", this.listCoffee);
    this.bot.action(/set_(\w+)/, this.setCoffeeTaste);
    this.bot.action("get_coffee", this.getCoffee);
    this.bot.action("donate", this.donate);
    this.bot.action(/buy_(\d+)/, this.createPayment);
    return this;
  }
}
