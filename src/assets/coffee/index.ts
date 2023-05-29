import { readdirSync } from "node:fs";
import path from "node:path";

export function randomCoffee() {
  const files = readdirSync(path.resolve(__dirname));
  const randomInt = Math.floor(Math.random() * files.length);
  return path.resolve(__dirname, `./${files[randomInt]}`);
}
