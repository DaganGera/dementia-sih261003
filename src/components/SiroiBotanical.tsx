import React from 'react';

/**
 * Siroi Lily (Lilium mackliniae) Botanical Components
 * Uses high-resolution, crystal-clean transparent PNGs directly extracted
 * from the user's authentic design reference image.
 */

// 1. Center Emblem: Open 6-petal Siroi Lily Flower
export const SiroiLilyLogo: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <img
    src="/images/flower_logo.png"
    alt="Siroi Lily Emblem"
    className={`object-contain pointer-events-none select-none ${className}`}
  />
);

// 2. Top Right Corner: Twin Nodding Bell Lilies with curved branches
export const SiroiTopRightLily: React.FC<{ className?: string }> = ({ className = 'w-64 h-auto' }) => (
  <img
    src="/images/flower_top_right.png"
    alt="Siroi Lily Top Right"
    className={`object-contain pointer-events-none select-none ${className}`}
  />
);

// 3. Bottom Left Corner: Slender upright stalk with drooping bell lily leaning right
export const SiroiBottomLeftLily: React.FC<{ className?: string }> = ({ className = 'w-48 h-auto' }) => (
  <img
    src="/images/flower_bottom_left.png"
    alt="Siroi Lily Bottom Left"
    className={`object-contain pointer-events-none select-none ${className}`}
  />
);

// 4. Bottom Right Corner: Upright stem with drooping bell lily leaning left
export const SiroiBottomRightLily: React.FC<{ className?: string }> = ({ className = 'w-48 h-auto' }) => (
  <img
    src="/images/flower_bottom_right.png"
    alt="Siroi Lily Bottom Right"
    className={`object-contain pointer-events-none select-none ${className}`}
  />
);
