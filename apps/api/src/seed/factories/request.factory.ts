import { at } from "../util.js";
import type { RequestStatus } from "@adopta/contracts";

export interface AdoptionRequestRow {
  id: string;
  petId: string;
  adopterId: string;
  guardianId: string;
  message: string;
  status: RequestStatus;
  createdAt: Date;
  respondedAt: Date | null;
}

export interface BuildRequestInput {
  id: string;
  petId: string;
  adopterId: string;
  guardianId: string;
  status: RequestStatus;
  createdAt: Date;
  respondedAt?: Date | null;
  message?: string;
  index?: number;
}

const MESSAGE_TEMPLATES = [
  "Hello, we saw your listing and would love to meet in person this week if possible.",
  "Hi there, we have a fenced garden and someone home most of the day — happy to send more details.",
  "Good afternoon, we have experience with rescues and can provide references if useful.",
  "Hi, our children have been asking for a pet and we think this could be a great match for our family.",
  "We live nearby and could arrange a visit any weekday evening, please let us know what works.",
];

export function buildAdoptionRequest(input: BuildRequestInput): AdoptionRequestRow {
  const message =
    input.message ??
    at(MESSAGE_TEMPLATES, (input.index ?? 0) % MESSAGE_TEMPLATES.length, "message templates");
  const respondedAt =
    input.respondedAt !== undefined
      ? input.respondedAt
      : input.status === "pending"
        ? null
        : input.createdAt;

  return {
    id: input.id,
    petId: input.petId,
    adopterId: input.adopterId,
    guardianId: input.guardianId,
    message,
    status: input.status,
    createdAt: input.createdAt,
    respondedAt,
  };
}
