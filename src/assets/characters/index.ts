import { readdirSync } from "node:fs";
import path from "node:path";

export interface Character {
  name: string;
  age: number;
  disposition: Disposition;
  topics: string[];
}

export enum Disposition {
  Cute = "cute",
  Genki = "genki",
  Ladylike = "ladylike",
  Fighter = "fighter",
  CoolGirl = "cool",
  Rational = "rational",
  Dreamer = "dreamer",
  Introverted = "introverted",
  Sibling = "sibling",
  Mysterious = "mysterious",
}

export const characters: Character[] = [
  {
    name: "Yui",
    age: 28,
    disposition: Disposition.Ladylike,
    topics: [
      "the weather",
      "anime you've watched recently",
      "favorite video game",
      "favorite movie",
    ],
  },
  {
    name: "Yumi",
    age: 18,
    disposition: Disposition.Cute,
    topics: [
      "the weather",
      "anime you've watched recently",
      "favorite book",
      "favorite movie",
      "elves life troubles",
    ],
  },
];

export function randomWaitress() {
  const randomInt = Math.floor(Math.random() * 10) % characters.length;

  return characters[randomInt];
}

export function randomPicture(chatacter: Character) {
  const files = readdirSync(
    path.resolve(__dirname, `./${chatacter.name.toLocaleLowerCase()}`),
  );
  const randomInt = Math.floor(Math.random() * files.length);
  return path.resolve(
    __dirname,
    `./${chatacter.name.toLowerCase()}/${files[randomInt]}`,
  );
}
