import { at } from "../util.js";

// Spec §2/§4 — "6 cities with realistic weighting." Weights are
// relative and only used by `cityFor`'s cumulative-distribution pick;
// they don't need to sum to any particular total.

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

/** Deterministic weighted pick from `unitInterval` (a value in [0, 1)). */
export function cityFor(unitInterval: number): string {
  const target = unitInterval * TOTAL_WEIGHT;
  let acc = 0;
  for (const city of CITIES) {
    acc += city.weight;
    if (target < acc) return city.name;
  }
  return at(CITIES, CITIES.length - 1, "CITIES").name;
}
