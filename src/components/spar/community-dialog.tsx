"use client";

import { useEffect, useState } from "react";
import { ExternalLink, MessageSquare, Sparkles, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getWhatsAppCommunityUrl } from "@/lib/community";

export const COMMUNITY_MODAL_SEEN_KEY = "spar.communityModalSeen";

interface CommunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommunityModalContent({
  onJoin,
  onDismiss,
}: {
  onJoin: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="space-y-4">
      <DialogHeader className="space-y-2 text-left">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C6FF3D]/40 bg-[#C6FF3D]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#C6FF3D]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C6FF3D]" aria-hidden />
            Community
          </span>
        </div>
        <DialogTitle className="font-display text-xl font-bold tracking-tight text-white">
          Join the Spar Community
        </DialogTitle>
        <DialogDescription className="text-xs leading-relaxed text-[var(--text-secondary)]">
          Connect with founders, speakers, and debaters sharpening their instincts. Direct line to the team, early access to new scenarios, and peer sparring.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2.5 rounded-2xl border border-[#27272F] bg-[#101014] p-3.5">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#C6FF3D]/15 text-[#C6FF3D]">
            <MessageSquare className="h-3.5 w-3.5" />
          </div>
          <div className="text-xs">
            <p className="font-semibold text-white">Direct Line to Founders</p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Request customized panelists, voice tones, and features directly.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#C6FF3D]/15 text-[#C6FF3D]">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="text-xs">
            <p className="font-semibold text-white">Early Feature Drops</p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Test new drill modes and sparring formats before anyone else.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#C6FF3D]/15 text-[#C6FF3D]">
            <Users className="h-3.5 w-3.5" />
          </div>
          <div className="text-xs">
            <p className="font-semibold text-white">Debaters &amp; Speakers Hub</p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Share debate tactics, pitch decks, and interview learnings.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2.5 pt-1">
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[#2C2C34] bg-[#18181D] px-4 text-xs font-semibold text-neutral-300 transition-colors hover:bg-[#22222A] hover:text-white"
        >
          Maybe later
        </button>
        <button
          type="button"
          onClick={onJoin}
          className="spar-volt-btn inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-5 text-xs font-bold text-[#0B0D06]"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Join WhatsApp Community</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function CommunityDialog({ open, onOpenChange }: CommunityDialogProps) {
  const communityUrl = getWhatsAppCommunityUrl();

  const handleJoin = () => {
    try {
      window.localStorage.setItem(COMMUNITY_MODAL_SEEN_KEY, "true");
    } catch {
      // Ignore storage write errors
    }
    window.open(communityUrl, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  };

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(COMMUNITY_MODAL_SEEN_KEY, "true");
    } catch {
      // Ignore storage write errors
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[24px] border-2 border-[var(--border-strong)] bg-[#141418] p-6 text-white shadow-[0_8px_0_0_#060608] sm:max-w-md">
        <CommunityModalContent onJoin={handleJoin} onDismiss={handleDismiss} />
      </DialogContent>
    </Dialog>
  );
}
