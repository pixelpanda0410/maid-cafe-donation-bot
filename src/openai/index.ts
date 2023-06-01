import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
  Configuration,
  OpenAIApi,
} from "openai";
import { ENVS } from "../config/env";
import { now } from "./time";
import { Character } from "../assets/characters";

export class OpenAIClient {
  private openAI = new OpenAIApi(
    new Configuration({
      apiKey: ENVS.server.openAIKey,
    }),
  );
  private cache = new Map<number, ChatCompletionRequestMessage[]>();

  public async startTopic(chatID: number, character: Character) {
    const topic =
      character.topics[Math.floor(Math.random() * character.topics.length)];
    const prompt = `You're a ${character.age} year old ${
      character.disposition
    } type girl, you work in a coffee shop and it's ${now()}. please talk about ${topic}.
    . write in Chinese language.`;

    return this.sendMessages(chatID, prompt);
  }

  public async chatWithCharacter(chatID: number, message: string) {
    return this.sendMessages(chatID, message);
  }

  public async getCoffeeTaste(chatID: number, ingredients: string) {
    const prompt = `Please generate a drink taste description based on those ingredients: ${ingredients}. write in Chinese language.`;
    return this.sendMessages(chatID, prompt);
  }

  private async sendMessages(chatID: number, content: string) {
    const newMessage = {
      role: ChatCompletionRequestMessageRoleEnum.User,
      content,
    };
    const messages = this.cache.get(chatID) ?? [];

    console.log({ type: "user", content });

    const completion = await this.openAI.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [...messages, newMessage],
    });
    messages.push(newMessage);
    const answer = completion.data.choices[0].message?.content;
    if (!answer) {
      throw new Error("No answer from OpenAI");
    }
    console.log({ type: "system", answer });

    messages.push({
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: answer,
    });

    this.cache.set(chatID, messages);

    return answer;
  }
}
