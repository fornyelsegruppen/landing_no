import { assertCustomerReplyTextSafe, customerReplyContextFromAnalysis } from "./customer-reply";

export type OutgoingMessage = {
  category: string;
  aiAssisted?: boolean | null;
  subject: string;
  bodyText: string;
  status: string;
  approvedAt?: string | null;
  aiAnalysis?: unknown;
};

export function assertMessageCanQueue(message: OutgoingMessage) {
  if (message.status !== "draft") throw new TypeError("Only a draft can be approved");
  if (!message.subject.trim() || !message.bodyText.trim()) throw new TypeError("Subject and message are required");
  if (message.aiAssisted) {
    const context = customerReplyContextFromAnalysis(message.aiAnalysis);
    if (context) assertCustomerReplyTextSafe(`${message.subject}\n${message.bodyText}`, context);
    else if (/\b\d[\d ]*(?:kr|nok)|kr\s*\/\s*m[²2]/i.test(`${message.subject}\n${message.bodyText}`)) {
      throw new TypeError("AI-assisted replies may not contain a price without an approved fact snapshot");
    }
  }
  if (/\bgaranterer\b|\b\d+\s*års?\s+garanti\b/i.test(`${message.subject}\n${message.bodyText}`)) {
    throw new TypeError("Unverified guarantees cannot be sent");
  }
  return true;
}

export function assertMessageCanDeliver(message: OutgoingMessage) {
  if (!["approved", "queued"].includes(message.status) || !message.approvedAt) {
    throw new TypeError("Message must have administrator approval");
  }
  return true;
}
