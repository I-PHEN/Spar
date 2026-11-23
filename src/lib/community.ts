export const WHATSAPP_COMMUNITY_FALLBACK_URL =
  "https://chat.whatsapp.com/FJRK385Epgn5axutA0BXzz";

export function getWhatsAppCommunityUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL?.trim() ||
    WHATSAPP_COMMUNITY_FALLBACK_URL
  );
}

export function hasConfiguredWhatsAppCommunityUrl(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL?.trim());
}
