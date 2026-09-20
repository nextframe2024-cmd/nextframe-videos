/**
 * Normalizes a WhatsApp Cloud API webhook payload into flat lead records.
 *
 * Cloud API posts inbound messages and delivery-status updates to the same
 * endpoint. Only `value.messages` is a lead; `value.statuses` is noise and is
 * dropped here so it never reaches the sink.
 */

const MEDIA_TYPES = ['image', 'audio', 'video', 'document', 'sticker'];

/** Pulls the human-readable text out of whichever shape the type uses. */
function extractText(message) {
  switch (message.type) {
    case 'text':
      return message.text?.body ?? '';
    case 'button':
      return message.button?.text ?? '';
    case 'reaction':
      return message.reaction?.emoji ?? '';
    case 'interactive':
      return (
        message.interactive?.button_reply?.title ??
        message.interactive?.list_reply?.title ??
        ''
      );
    default:
      // Media types carry an optional caption.
      return message[message.type]?.caption ?? '';
  }
}

function extractMediaId(message) {
  if (!MEDIA_TYPES.includes(message.type)) return '';
  return message[message.type]?.id ?? '';
}

function extractLocation(message) {
  if (message.type !== 'location') return '';
  const { latitude, longitude } = message.location ?? {};
  if (latitude === undefined || longitude === undefined) return '';
  return `${latitude},${longitude}`;
}

/** WhatsApp timestamps are unix seconds as a string. */
function toIso(timestamp) {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

export function parseLeads(payload) {
  if (payload?.object !== 'whatsapp_business_account') return [];

  const leads = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      if (!Array.isArray(value.messages)) continue;

      // wa_id -> profile name, so a lead carries the sender's display name.
      const names = new Map(
        (value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? '']),
      );

      for (const message of value.messages) {
        leads.push({
          received_at: toIso(message.timestamp),
          wa_message_id: message.id ?? '',
          from: message.from ?? '',
          name: names.get(message.from) ?? '',
          type: message.type ?? '',
          text: extractText(message),
          media_id: extractMediaId(message),
          location: extractLocation(message),
          phone_number_id: value.metadata?.phone_number_id ?? '',
        });
      }
    }
  }

  return leads;
}
