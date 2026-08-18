import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { prisma } from "../db";
import type { Ticket } from "../../generated/prisma/client";
import { categoryValues, type Category } from "./categories";

function isCategory(value: string): value is Category {
  return (categoryValues as readonly string[]).includes(value);
}

async function classifyTicket(ticket: Ticket) {
  const { text } = await generateText({
    model: google("gemini-flash-latest"),
    prompt:
      `Classify the support ticket below into exactly one of these categories: ${categoryValues.join(", ")}. ` +
      "Respond with only the category name in lowercase, no punctuation or explanation.\n\n" +
      `Subject: ${ticket.subject}\n\nBody:\n${ticket.body}`,
  });

  const category = text.trim().toLowerCase();
  if (!isCategory(category)) {
    console.error(`classify: model returned unrecognized category "${category}" for ticket ${ticket.id}`);
    return;
  }

  await prisma.ticket.update({ where: { id: ticket.id }, data: { category } });
}

// Fire-and-forget: callers don't await this, so ticket creation never blocks on Gemini.
export function classifyTicketInBackground(ticket: Ticket) {
  classifyTicket(ticket).catch((err) => {
    console.error(`classify failed for ticket ${ticket.id}:`, err);
  });
}
