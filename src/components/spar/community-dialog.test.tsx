import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Dialog } from "@/components/ui/dialog";
import { getWhatsAppCommunityUrl } from "@/lib/community";
import { CommunityModalContent } from "./community-dialog";

describe("CommunityDialog", () => {
  test("resolves default WhatsApp invite URL to the Spar community group", () => {
    expect(getWhatsAppCommunityUrl()).toBe(
      "https://chat.whatsapp.com/FJRK385Epgn5axutA0BXzz",
    );
  });

  test("renders community pop-up with Volt styling, founder direct line, and WhatsApp action", () => {
    const markup = renderToStaticMarkup(
      <Dialog open>
        <CommunityModalContent onJoin={() => {}} onDismiss={() => {}} />
      </Dialog>,
    );

    expect(markup).toContain("Join the Spar Community");
    expect(markup).toContain("Direct Line to Founders");
    expect(markup).toContain("Early Feature Drops");
    expect(markup).toContain("Debaters &amp; Speakers Hub");
    expect(markup).toContain("Join WhatsApp Community");
    expect(markup).toContain("Maybe later");
    expect(markup).toContain("#C6FF3D");
  });
});
