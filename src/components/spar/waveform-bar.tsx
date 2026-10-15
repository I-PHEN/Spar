"use client";

/**
 * Subtle waveform bar — thin bars that move with voice amplitude.
 *
 * Shows alongside a "Listening" indicator in the bottom bar.
 * Works across ALL modes (Defense, Boardroom, Q&A, Drill).
 */
export function WaveformBar({ amplitude }: { amplitude: number }) {
  // 14 bars for a fuller waveform feel
  const bars = Array.from({ length: 14 }, (_, i) => {
    // Each bar has a slightly different sensitivity for organic feel
    const center = Math.abs(i - 6.5); // distance from center
    const sensitivity = 0.6 + (1 - center / 7) * 0.4;
    const height = Math.min(1, amplitude * sensitivity * 1.5);
    return height;
  });

  return (
    <div className="flex items-center gap-[2px] h-5">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full transition-all duration-75"
          style={{
            height: `${Math.max(3, h * 20)}px`,
            backgroundColor: "rgb(115, 115, 115)",
            opacity: 0.25 + h * 0.6,
          }}
        />
      ))}
    </div>
  );
}
