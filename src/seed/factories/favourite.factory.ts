export interface FavouriteRow {
  userId: string;
  petId: string;
  createdAt: Date;
}

export function buildFavourite(userId: string, petId: string, createdAt: Date): FavouriteRow {
  return { userId, petId, createdAt };
}
