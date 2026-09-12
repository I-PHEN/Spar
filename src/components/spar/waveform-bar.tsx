"use client";

/**
 * Subtle waveform bar — a thin line that moves with voice amplitude.
 *
 * Not a big visual element. Just a confirmation that the system is
 * hearing you. Sits near the mic button in the bottom bar.
 */
export function WaveformBar({ amplitude }: { amplitude: number }) {
  // 12 bars, each responds to amplitude with slight variation
  const bars = Array.from({ length: 12 }, (_, i) => {
    // Each bar has a slightly different sensitivity for organic feel
    const sensitivity = 0.7 + Math.sin(i * 0.8) * 0.3;
    const height = Math.min(1, amplitude * sensitivity);
    return height;
  });

  return (
    <div className="flex items-center gap-[2px] h-4">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-[2px] bg-neutral-400 rounded-full transition-all duration-75"
          style={{
            height: `${Math.max(2, h * 16)}px`,
            opacity: 0.3 + h * 0.5,
          }}
        />
      ))}
    </div>
  );
}
