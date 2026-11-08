'use client';
import { cn } from '@/lib/utils';
import { useState, createContext, useContext } from 'react';
import {
  motion,
  MotionValue,
  SpringOptions,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';

/*
 * Motion Primitives Image Comparison, patched (docs/TECHNICAL_DECISIONS.md, D35). Upstream works
 * only by dragging. The handle is now a real slider, with its role, value and the arrow, Home and
 * End keys, and a layer can hold any content, so a diagram can sit opposite a screenshot.
 */
const KEY_STEP = 5;

const ImageComparisonContext = createContext<
  | {
      sliderPosition: number;
      moveTo: (pos: number) => void;
      motionSliderPosition: MotionValue<number>;
    }
  | undefined
>(undefined);

export type ImageComparisonProps = {
  children: React.ReactNode;
  className?: string;
  springOptions?: SpringOptions;
};

const DEFAULT_SPRING_OPTIONS = {
  bounce: 0,
  duration: 0,
};

function ImageComparison({
  children,
  className,
  springOptions,
}: ImageComparisonProps) {
  const [isDragging, setIsDragging] = useState(false);
  const motionValue = useMotionValue(50);
  const motionSliderPosition = useSpring(
    motionValue,
    springOptions ?? DEFAULT_SPRING_OPTIONS
  );
  const [sliderPosition, setSliderPosition] = useState(50);

  const moveTo = (position: number) => {
    const percentage = Math.min(Math.max(position, 0), 100);
    motionValue.set(percentage);
    setSliderPosition(percentage);
  };

  const handleDrag = (event: React.PointerEvent) => {
    if (!isDragging) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    moveTo(((event.clientX - rect.left) / rect.width) * 100);
  };

  return (
    <ImageComparisonContext.Provider
      value={{ sliderPosition, moveTo, motionSliderPosition }}
    >
      <div
        className={cn(
          'relative touch-pan-y select-none overflow-hidden',
          className
        )}
        onPointerMove={handleDrag}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setIsDragging(true);
          const rect = event.currentTarget.getBoundingClientRect();
          moveTo(((event.clientX - rect.left) / rect.width) * 100);
        }}
        onPointerUp={() => setIsDragging(false)}
        onPointerCancel={() => setIsDragging(false)}
      >
        {children}
      </div>
    </ImageComparisonContext.Provider>
  );
}

const ImageComparisonLayer = ({
  className,
  children,
  position,
}: {
  className?: string;
  children: React.ReactNode;
  position: 'left' | 'right';
}) => {
  const { motionSliderPosition } = useContext(ImageComparisonContext)!;
  const leftClipPath = useTransform(
    motionSliderPosition,
    (value) => `inset(0 0 0 ${value}%)`
  );
  const rightClipPath = useTransform(
    motionSliderPosition,
    (value) => `inset(0 ${100 - value}% 0 0)`
  );

  return (
    <motion.div
      className={cn('absolute inset-0 h-full w-full', className)}
      style={{
        clipPath: position === 'left' ? leftClipPath : rightClipPath,
      }}
    >
      {children}
    </motion.div>
  );
};

const ImageComparisonSlider = ({
  className,
  children,
  label,
  valueText,
}: {
  className?: string;
  children?: React.ReactNode;
  label: string;
  /** Says what the position means, for screen readers. */
  valueText: (position: number) => string;
}) => {
  const { motionSliderPosition, sliderPosition, moveTo } = useContext(
    ImageComparisonContext
  )!;
  const left = useTransform(motionSliderPosition, (value) => `${value}%`);

  return (
    <motion.div
      role='slider'
      tabIndex={0}
      aria-label={label}
      aria-orientation='horizontal'
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(sliderPosition)}
      aria-valuetext={valueText(Math.round(sliderPosition))}
      className={cn('absolute bottom-0 top-0 w-1 cursor-ew-resize', className)}
      style={{ left }}
      onKeyDown={(event) => {
        const next = {
          ArrowLeft: sliderPosition - KEY_STEP,
          ArrowDown: sliderPosition - KEY_STEP,
          ArrowRight: sliderPosition + KEY_STEP,
          ArrowUp: sliderPosition + KEY_STEP,
          Home: 0,
          End: 100,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        moveTo(next);
      }}
    >
      {children}
    </motion.div>
  );
};

export { ImageComparison, ImageComparisonLayer, ImageComparisonSlider };
