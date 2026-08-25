import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's stock scale, so the design system's
// fontSize tokens (text-button, text-body, …) fall through to the text-color
// group and cancel real color classes in the same cn() call — e.g. text-button
// silently dropped text-brand-fg from the primary Button (#62). Declaring them
// as font-size classes keeps size and color merging independently.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "h1",
            "h2",
            "body",
            "body-semibold",
            "body-16",
            "body-12",
            "button",
            "label",
            "caption",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
