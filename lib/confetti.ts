import confetti from 'canvas-confetti';

// Brand-colored celebration burst. Respects prefers-reduced-motion automatically.
export function celebrate() {
  confetti({
    particleCount: 90,
    spread: 75,
    origin: { y: 0.7 },
    colors: ['#10B981', '#16FFAB', '#0CB475', '#E2E3E1'],
    disableForReducedMotion: true,
  });
}
