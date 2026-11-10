/** Navigation directions; also the suffix of the `month-*` and `day-*` transition types. */
export type Step = "prev" | "next";

/** A day's image keeps one identity between its calendar cell and the open card, so it morphs between them. */
export const dayImageName = (date: string) => `day-${date}`;

/** The day's calendar cell and the open card are one box that grows and shrinks, with the image riding inside. */
export const dayCardName = (date: string) => `card-${date}`;

export const DAY_CARD_SHARE = { "day-open": "card-open", "day-close": "card-close", default: "none" };

/** The card's corners grow from the cell's, which differ between the week and month views and by screen size. */
export function rememberCellRadius(cell: HTMLElement) {
  document.documentElement.style.setProperty("--cell-radius", getComputedStyle(cell).borderRadius);
}

/** Morph only when a day opens or closes; stepping between days or months moves it with its surroundings. */
export const DAY_IMAGE_SHARE = {
  "day-open": "morph-open",
  "day-close": "morph-close",
  "view-month": "morph",
  "view-week": "morph",
  default: "none",
};
