'use client';
import { useEffect, useRef, useState } from 'react';

export type TextScrambleProps = {
  children: string;
  duration?: number;
  speed?: number;
  characterSet?: string;
  as?: React.ElementType;
  className?: string;
  trigger?: boolean;
  onScrambleComplete?: () => void;
} & React.HTMLAttributes<HTMLElement>;

const defaultChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function TextScramble({
  children,
  duration = 0.8,
  speed = 0.04,
  characterSet = defaultChars,
  className,
  as: Component = 'p',
  trigger = true,
  onScrambleComplete,
  ...props
}: TextScrambleProps) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scrambledText, setScrambledText] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const text = children;
  const displayText = scrambledText ?? children;

  const scramble = async () => {
    if (isAnimating) return;
    setIsAnimating(true);

    const steps = duration / speed;
    let step = 0;

    timer.current = setInterval(() => {
      let scrambled = '';
      const progress = step / steps;

      for (let i = 0; i < text.length; i++) {
        if (!/[A-Za-z0-9]/.test(text[i]!)) {
          scrambled += text[i];
          continue;
        }

        if (progress * text.length > i) {
          scrambled += text[i];
        } else {
          scrambled +=
            characterSet[Math.floor(Math.random() * characterSet.length)];
        }
      }

      setScrambledText(scrambled);
      step++;

      if (step > steps) {
        if (timer.current) clearInterval(timer.current);
        setScrambledText(null);
        setIsAnimating(false);
        onScrambleComplete?.();
      }
    }, speed * 1000);
  };

  useEffect(() => {
    if (!trigger) return;

    scramble();
  }, [trigger]);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    []
  );

  return (
    <Component className={className} {...props}>
      {displayText}
    </Component>
  );
}
