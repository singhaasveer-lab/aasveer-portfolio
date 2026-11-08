"use client";

import { useOptionalExplorer } from "@/components/explorer/ExplorerProvider";
import {
  ImageComparison,
  ImageComparisonLayer,
  ImageComparisonSlider,
} from "@/components/motion-primitives/image-comparison";
import { ArchitectureSketch } from "@/components/projects/ArchitectureSketch";

/**
 * The application and its architecture on one surface, with a slider between them: drag it, or
 * focus the handle and use the arrow keys. Loaded only when a case study opens.
 */
export function ProjectComparison({
  slug,
  name,
  src,
  alt,
}: {
  slug: string;
  name: string;
  src: string;
  alt: string;
}) {
  const architecture = useOptionalExplorer()?.architectures.find((a) => a.slug === slug);
  return (
    <ImageComparison className="case-compare">
      {/* eslint-disable-next-line @next/next/no-img-element -- it must fill the comparison surface */}
      <img src={src} alt={alt} className="case-compare-shot" />
      {architecture && (
        <>
          <ImageComparisonLayer position="left" className="case-compare-sketch">
            <ArchitectureSketch architecture={architecture} name={name} />
          </ImageComparisonLayer>
          <span className="case-compare-tag" data-side="left" aria-hidden="true">
            Application
          </span>
          <span className="case-compare-tag" data-side="right" aria-hidden="true">
            Architecture
          </span>
          <ImageComparisonSlider
            className="case-compare-handle"
            label={`Compare the ${name} application with its architecture`}
            valueText={(position) => `${position}% application, ${100 - position}% architecture`}
          >
            <span className="case-compare-grip" aria-hidden="true" />
          </ImageComparisonSlider>
        </>
      )}
    </ImageComparison>
  );
}
