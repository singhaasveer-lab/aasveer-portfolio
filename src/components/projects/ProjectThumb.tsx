"use client";

import { Tilt } from "@/components/motion-primitives/tilt";
import { useFinePointer } from "@/hooks/useFinePointer";

/** A slight tilt on a card's screenshot, for fine pointers with motion allowed. */
export function ProjectThumb({ children }: { children: React.ReactNode }) {
  const fine = useFinePointer();
  return (
    <Tilt
      className="case-thumb"
      rotationFactor={3}
      springOptions={{ stiffness: 160, damping: 22, mass: 0.5 }}
      disabled={!fine}
    >
      {children}
    </Tilt>
  );
}
