"use client";

import { useEffect, useRef } from "react";
import { CornerDownRight, Quote } from "lucide-react";
import type { ArchetypeKey, MessageType } from "@/lib/types";
import { PersonaAvatar } from "./persona-avatar";
import { cn } from "@/lib/utils";

export interface TranscriptMessage {
  id: string;
  role: "user" | "persona" | "system" | "coach";
  personaId?: string | null;
  personaName?: string;
  archetype?: ArchetypeKey;
  content: string;
  type: MessageType;
  claimRef?: number | null;
  /** When true, render with a streaming caret (still being typed out) */
  streaming?: boolean;
  createdAt: string | Date;
}

interface TranscriptProps {
  messages: TranscriptMessage[];
  /** Persona states keyed by personaId — for avatar rendering */
  personaStates?: Record<string, "idle" | "listening" | "thinking" | "speaking" | "about-to-interrupt">;
}

/**
 * The live transcript — the center column of the Sparring Room.
 * Renders user and persona messages with distinct treatments.
 */
export function Transcript({ messages, personaStates }: TranscriptProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
      {messages.map((m) => (
        <MessageRow key={m.id} message={m} personaStates={personaStates} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function MessageRow({
  message,
  personaStates,
}: {
  message: TranscriptMessage;
  personaStates?: TranscriptProps["personaStates"];
}) {
  if (message.role === "user") {
    return <UserMessage content={message.content} streaming={message.streaming} />;
  }

  if (message.role === "persona") {
    return (
      <PersonaMessage
        message={message}
        avatarState={personaStates?.[message.personaId || ""] || "idle"}
      />
    );
  }

  if (message.role === "system") {
    return (
      <div className="mx-auto my-2 text-center text-[11px] uppercase tracking-wider text-muted-foreground/50">
        {message.content}
      </div>
    );
  }

  return null;
}

function UserMessage({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  return (
    <div className="flex justify-end spar-fade-up">
      <div className="max-w-[80%]">
        <div className="mb-1 text-right text-[10px] uppercase tracking-wider text-muted-foreground/60">
          You
        </div>
        <div
          className={cn(
            "rounded-md rounded-br-sm bg-[#171717] border border-[#2a2a2a] px-4 py-2.5 text-sm text-foreground/90",
            streaming && "spar-caret"
          )}
        >
          {content}
        </div>
      </div>
    </div>
  );
}

function PersonaMessage({
  message,
  avatarState,
}: {
  message: TranscriptMessage;
  avatarState: "idle" | "listening" | "thinking" | "speaking" | "about-to-interrupt";
}) {
  const isInterruption = message.type === "interruption";
  const isOpening = message.type === "opening";
  const archetype = message.archetype;

  return (
    <div className="flex gap-3 spar-fade-up">
      <div className="flex-shrink-0 pt-1">
        <PersonaAvatar
          archetype={archetype || "skeptic"}
          size="sm"
          state={message.streaming ? "speaking" : avatarState}
        />
      </div>
      <div className={cn("min-w-0 flex-1", isInterruption && "spar-interrupt-in")}>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium text-foreground/90">
            {message.personaName}
          </span>
          {isOpening && (
            <span className="rounded border border-white/20 bg-white/5 px-1 py-px text-[9px] uppercase tracking-wider text-foreground/80">
              Opening
            </span>
          )}
          {isInterruption && (
            <span className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-foreground/60">
              <CornerDownRight className="h-3 w-3" />
              Interrupting
            </span>
          )}
          {typeof message.claimRef === "number" && message.claimRef > 0 && (
            <span className="rounded border border-border bg-muted/40 px-1 py-px text-[9px] uppercase tracking-wider text-muted-foreground/70">
              → Claim {message.claimRef}
            </span>
          )}
        </div>
        <div
          className={cn(
            "rounded-md rounded-bl-sm border px-4 py-2.5 text-sm text-foreground/90",
            isInterruption
              ? "border-[#2a2a2a] bg-[#141414] ml-2"
              : "border-[#1a1a1a] bg-[#0f0f0f]"
          )}
        >
          <span className={message.streaming ? "spar-caret" : ""}>{message.content}</span>
        </div>
        {isOpening && (
          <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/50">
            The room is open. Make your case.
          </p>
        )}
      </div>
    </div>
  );
}

/** Quote mark icon — used in some decorative contexts */
export function QuoteMark() {
  return <Quote className="h-3 w-3 text-muted-foreground/40" />;
}
