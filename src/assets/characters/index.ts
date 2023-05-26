export interface Character {
  name: string;
  age: number;
  disposition: Disposition;
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
  // {
  //   name: "Yui",
  //   age: 18,
  //   disposition: Disposition.Cute,
  // },
  // {
  //   name: "Hana",
  //   age: 16,
  //   disposition: Disposition.Genki,
  // },
  {
    name: "Yumi",
    age: 24,
    disposition: Disposition.Ladylike,
  },
];

export function randomWaitress() {
  const randomInt = Math.floor(Math.random() * 10) % characters.length;

  return characters[randomInt];
}
