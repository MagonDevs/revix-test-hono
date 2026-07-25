import { at } from "../util.js";

const openers = [
  "{name} came to us from a rescue in {city} last spring.",
  "We found {name} on a roadside near {city} and have been fostering since.",
  "{name} has been with our family for two years, but our new flat does not allow pets.",
  "{name} was surrendered by a family in {city} who could no longer care for them.",
  "A neighbour in {city} asked us to find {name} a new home after moving abroad.",
];

const temperament = [
  "She is calm indoors and settles quickly once she has a blanket of her own.",
  "He is energetic in the mornings and sleeps most of the afternoon.",
  "She is shy for the first day or two, then follows you everywhere.",
  "He is playful with other animals and loves attention from visitors.",
  "She is independent but affectionate, and enjoys quiet company in the evening.",
];

const practical = [
  "Walks well on a lead and travels calmly in the car.",
  "Fully house-trained and comfortable being left for a few hours.",
  "Eats twice a day and has no dietary restrictions.",
  "Up to date on vaccinations and used to regular vet visits.",
  "Gets along well with children and other pets in the household.",
];

const closers = [
  "We are looking for a home with a garden and someone around during the day.",
  "Ideally an adult household, or one with older children.",
  "We would love to stay in touch and hear how she settles in.",
  "Happy to answer any questions before you decide to meet in person.",
  "A calm, patient home would suit them best for the first few weeks.",
];

function pick<T>(list: T[], index: number): T {
  return at(list, index % list.length, "fragment list");
}

function fill(template: string, name: string, city: string): string {
  return template.replaceAll("{name}", name).replaceAll("{city}", city);
}

export function composeDescription(
  name: string,
  city: string,
  indices: { opener: number; temperament: number; practical: number; closer: number },
): string {
  const sentences = [
    fill(pick(openers, indices.opener), name, city),
    pick(temperament, indices.temperament),
    pick(practical, indices.practical),
    pick(closers, indices.closer),
  ];
  const text = sentences.join(" ");

  if (text.length < 180 || text.length > 600) {
    throw new Error(`composeDescription produced ${text.length} chars, expected 180-600`);
  }

  return text;
}
