import { at } from "../util.js";

export interface WeightedCity {
  name: string;
  weight: number;
}

export const CITIES: WeightedCity[] = [
  { name: "Madrid", weight: 30 },
  { name: "Barcelona", weight: 25 },
  { name: "Valencia", weight: 15 },
  { name: "Sevilla", weight: 12 },
  { name: "Bilbao", weight: 10 },
  { name: "Zaragoza", weight: 8 },
];

const TOTAL_WEIGHT = CITIES.reduce((sum, c) => sum + c.weight, 0);

export function cityFor(unitInterval: number): string {
  const target = unitInterval * TOTAL_WEIGHT;
  let acc = 0;
  for (const city of CITIES) {
    acc += city.weight;
    if (target < acc) return city.name;
  }
  return at(CITIES, CITIES.length - 1, "CITIES").name;
}
