import { arrayToMap } from "@excalidraw/common";

import { mutateElement } from "./mutateElement";
import { refreshTextDimensions } from "./newElement";
import { isTextElement } from "./typeChecks";

import type { ExcalidrawElement, ExcalidrawTextElement } from "./types";

/**
 * A list marker a text starts with: `1.`, `1)`, `(1)`, `[1]`, `a.`, `a)`,
 * `A.` or `A)`. Must be followed by whitespace (or nothing), so that `1.5`
 * or `e.g.` aren't list markers.
 *
 * (Letters only take `.` and `)`, as `(a)` and `[a]` tend to mean other
 * things.)
 */
const LIST_MARKER_REGEX =
  /^(\s*)(?:\((\d{1,9})\)|\[(\d{1,9})\]|(\d{1,9}|[a-zA-Z])([.)]))(?=\s|$)/;

type ListMarker = {
  /** where the marker's value starts in the text */
  index: number;
  value: string;
  /** e.g. `1.` and `2.` are of the same style, but `1.` and `(1)` aren't */
  style: string;
  ordinal: number;
};

const parseListMarker = (text: string): ListMarker | null => {
  const match = text.match(LIST_MARKER_REGEX);
  if (!match) {
    return null;
  }

  const [, indent, parenValue, bracketValue, plainValue, plainSuffix] = match;
  const value = parenValue ?? bracketValue ?? plainValue;
  const isNumber = /\d/.test(value);
  const kind = isNumber
    ? "decimal"
    : value === value.toLowerCase()
    ? "lower"
    : "upper";
  const affixes =
    parenValue !== undefined
      ? "()"
      : bracketValue !== undefined
      ? "[]"
      : plainSuffix;

  return {
    index: indent.length + (plainValue !== undefined ? 0 : 1),
    value,
    style: `${kind}${affixes}`,
    ordinal: isNumber
      ? parseInt(value, 10)
      : value.toLowerCase().charCodeAt(0) - "a".charCodeAt(0),
  };
};

/**
 * @returns the list marker the text starts with, unless the text is a whole
 *          list (other lines start with markers of the same style)
 */
const getListItemMarker = (text: string): ListMarker | null => {
  const marker = parseListMarker(text);
  if (!marker) {
    return null;
  }

  const otherLines = text.slice(marker.index).split("\n").slice(1);
  if (
    otherLines.some((line) => parseListMarker(line)?.style === marker.style)
  ) {
    return null;
  }

  return marker;
};

/** @returns `null` if there's no next marker (past `z`) */
const advanceListMarker = (
  text: string,
  marker: ListMarker,
  step: number,
): string | null => {
  const ordinal = marker.ordinal + step;

  let value: string;
  if (marker.style.startsWith("decimal")) {
    // keep zero padding (`01.` -> `02.`)
    value = String(ordinal).padStart(
      marker.value.startsWith("0") ? marker.value.length : 0,
      "0",
    );
  } else {
    if (ordinal > 25) {
      return null;
    }
    value = String.fromCharCode(
      (marker.style.startsWith("lower") ? "a" : "A").charCodeAt(0) + ordinal,
    );
  }

  return (
    text.slice(0, marker.index) +
    value +
    text.slice(marker.index + marker.value.length)
  );
};

/**
 * Advances the list markers of the duplicated (unbound) texts, so that
 * duplicating `1. foo` gives `2. foo`.
 *
 * Duplicating several items of a list at once continues the list:
 * duplicating `1.`–`3.` gives `4.`–`6.`. Texts duplicated as part of
 * a frame are left as they are.
 *
 * Mutates the duplicates, so call it before they get into the scene.
 */
export const advanceDuplicatedListMarkers = (
  duplicatedElements: readonly ExcalidrawElement[],
) => {
  const duplicatesMap = arrayToMap(duplicatedElements);

  const items: { element: ExcalidrawTextElement; marker: ListMarker }[] = [];
  // per marker style
  const ranges = new Map<string, { min: number; max: number }>();

  for (const element of duplicatedElements) {
    if (
      !isTextElement(element) ||
      element.containerId ||
      (element.frameId && duplicatesMap.has(element.frameId))
    ) {
      continue;
    }

    const marker = getListItemMarker(element.originalText);
    if (!marker) {
      continue;
    }

    items.push({ element, marker });

    const range = ranges.get(marker.style);
    ranges.set(marker.style, {
      min: Math.min(range?.min ?? Infinity, marker.ordinal),
      max: Math.max(range?.max ?? -Infinity, marker.ordinal),
    });
  }

  for (const { element, marker } of items) {
    const { min, max } = ranges.get(marker.style)!;
    const originalText = advanceListMarker(
      element.originalText,
      marker,
      max - min + 1,
    );
    if (originalText === null) {
      continue;
    }

    mutateElement(element, duplicatesMap, {
      originalText,
      // re-wraps the text, and keeps it anchored as per its alignment
      ...refreshTextDimensions(element, null, duplicatesMap, originalText),
    });
  }
};
