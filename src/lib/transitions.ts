/** Navigation directions; also the suffix of the `month-*` and `day-*` transition types. */
export type Step = "prev" | "next";

/** A day's image keeps one identity between its calendar cell and the open card, so it morphs between them. */
export const dayImageName = (date: string) => `day-${date}`;

/** Morph only when a day opens or closes; stepping between days or months moves it with its surroundings. */
export const DAY_IMAGE_SHARE = {
  "day-open": "morph-open",
  "day-close": "morph-close",
  "view-month": "morph",
  "view-week": "morph",
  default: "none",
};
