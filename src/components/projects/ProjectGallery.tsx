"use client";

import { useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNavigation,
} from "@/components/motion-primitives/carousel";

export interface GalleryShot {
  src: string;
  alt: string;
  label: string;
}

/** More screens of a project, for those that have them. Loaded only when a case study opens. */
export function ProjectGallery({ shots, name }: { shots: GalleryShot[]; name: string }) {
  const [index, setIndex] = useState(0);
  return (
    <section
      className="case-gallery"
      aria-label={`More screens of ${name}`}
      data-testid="project-gallery"
    >
      <Carousel index={index} onIndexChange={setIndex}>
        <CarouselContent>
          {shots.map((shot) => (
            <CarouselItem key={shot.src}>
              {/* eslint-disable-next-line @next/next/no-img-element -- it sits in a draggable track */}
              <img src={shot.src} alt={shot.alt} draggable={false} loading="lazy" />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselNavigation
          alwaysShow
          className="left-0 w-full"
          classNameButton="case-gallery-button bg-[rgb(8_12_24/0.92)] dark:bg-[rgb(8_12_24/0.92)]"
        />
      </Carousel>
      <p className="case-gallery-label" aria-live="polite">
        {shots[index]!.label} ({index + 1} of {shots.length})
      </p>
    </section>
  );
}
