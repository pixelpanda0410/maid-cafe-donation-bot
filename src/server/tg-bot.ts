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
import { randomPicture, randomWaitress } from "../assets/characters";
import { OpenAIClient } from "../openai";
import { randomCoffee } from "../assets/coffee";

type ActionContext = NarrowedContext<
  Context<Update> & {
    match: RegExpExecArray;
  },
  Update.CallbackQueryUpdate<CallbackQuery>
>;

interface CoffeeIngredients {
  messageID: number;
  ingredients: string[];
}

export class TGBot {
  private bot: Telegraf<Context<Update>>;
  private cache: Map<number, CoffeeIngredients> = new Map();
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

  private get coffeeIngredientsButton() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("咖啡基底", "add_咖啡"),
        Markup.button.callback("绿茶基底", "add_绿茶"),
        Markup.button.callback("红茶基底", "add_红茶"),
      ],
      [
        Markup.button.callback("热水", "add_热水"),
        Markup.button.callback("牛奶", "add_牛奶"),
        Markup.button.callback("奶泡", "add_奶泡"),
        Markup.button.callback("奶油", "add_奶油"),
      ],
      [
        Markup.button.callback("糖", "add_糖"),
        Markup.button.callback("蜂蜜", "add_蜂蜜"),
        Markup.button.callback("糖浆", "add_糖浆"),
        Markup.button.callback("炼乳", "add_炼乳"),
      ],
      [
        Markup.button.callback("可可粉", "add_可可粉"),
        Markup.button.callback("肉桂粉", "add_肉桂粉"),
        Markup.button.callback("丁香粉", "add_丁香粉"),
        Markup.button.callback("豆蔻粉", "add_豆蔻粉"),
      ],
      [
        Markup.button.callback("姜粉", "add_姜粉"),
        Markup.button.callback("香草精", "add_香草精"),
        Markup.button.callback("薄荷叶", "add_薄荷叶"),
        Markup.button.callback("橙皮", "add_橙皮"),
      ],
      [Markup.button.callback("决定了", "get_coffee")],
    ]);
  }

  private listCoffee = async (ctx: ActionContext) => {
    const res = await ctx.reply(
      "选择您想要的口味，别忘了点“决定了”哦！",
      this.coffeeIngredientsButton,
    );
    this.cache.set(ctx.from?.id!, {
      messageID: res.message_id,
      ingredients: [],
    });
  };

  private addCoffeeIngredients = async (ctx: ActionContext) => {
    const chatID = ctx.from?.id;
    if (!chatID) {
      return;
    }
    let coffeeTaste = this.cache.get(chatID);
    if (!coffeeTaste) {
      return this.listCoffee(ctx);
    } else if (coffeeTaste.ingredients.length >= 5) {
      return ctx.answerCbQuery("最多只能选五种哦！");
    }
    const value = ctx.match[1];
    coffeeTaste.ingredients.push(value);
    this.cache.set(chatID, coffeeTaste);
    const message = this.formatCoffeeTaste(coffeeTaste.ingredients);
    return ctx.editMessageText(message, this.coffeeIngredientsButton);
  };

  private formatCoffeeTaste = (coffeeIngredient: string[]) => {
    return coffeeIngredient.join(", ");
  };

  private getCoffee = async (ctx: ActionContext) => {
    const chatID = ctx.from?.id;
    if (!chatID) {
      return;
    }
    const message = this.formatCoffeeTaste(this.cache.get(chatID)!.ingredients);
    const reply = await this.openAIClient.getCoffeeTaste(chatID, message);

    this.cache.delete(chatID);

    const coffeePic = randomCoffee();

    console.log(coffeePic);

    return ctx.replyWithPhoto(
      {
        source: coffeePic,
      },
      {
        caption: `*${reply}*`,
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback("再来一杯", "list_drinks")],
            [Markup.button.callback("为咖啡店捐款", "donate")],
          ],
        },
      },
    );
  };

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
          source: randomPicture(waitress),
        },
        {
          caption: `*${greeting}*`,
          parse_mode: "MarkdownV2",
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback("来点喝的", "list_drinks")],
            ],
          },
        },
      );
    });

    this.bot.action("list_drinks", this.listCoffee);
    this.bot.action(/add_(.+)/, this.addCoffeeIngredients);
    this.bot.action("get_coffee", this.getCoffee);
    this.bot.action("donate", this.donate);
    this.bot.action(/buy_(\d+)/, this.createPayment);
    return this;
  }
}
