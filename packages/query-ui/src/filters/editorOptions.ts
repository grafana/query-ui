import type { EditorOption, EditorStep } from './editorState';

export const ITEM_HEIGHT = 38;
export const ITEM_HEIGHT_WITH_DESCRIPTION = 60;
export const MAX_MENU_HEIGHT = 300;
export const MIN_MENU_WIDTH = 182;
export const ERROR_MENU_WIDTH = 366;

const CHAR_WIDTH = 8;
const DESCRIPTION_CHAR_WIDTH = 6;
const ITEM_PADDING = 8;
/** Extra characters for the "Use custom value: " prefix. */
const CUSTOM_PREFIX_LENGTH = 18;

/**
 * Case-insensitive substring search over label and value. Exact matches rank
 * first, then prefix matches, then the rest, each in the original order.
 */
export function searchOptions(
  options: EditorOption[],
  search: string,
): EditorOption[] {
  const query = search.trim().toLowerCase();

  if (!query) {
    return options;
  }

  const ranked: Array<{ option: EditorOption; rank: number }> = [];

  for (const option of options) {
    const label = option.label.toLowerCase();
    const labelIndex = label.indexOf(query);

    if (labelIndex === -1 && !option.value.toLowerCase().includes(query)) {
      continue;
    }

    let rank = 2;
    if (label === query) {
      rank = 0;
    } else if (labelIndex === 0) {
      rank = 1;
    }

    ranked.push({ option, rank });
  }

  // Array.prototype.sort is stable, so equal ranks keep their source order.
  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.option);
}

export interface DropdownItemsInput {
  options: EditorOption[];
  step: EditorStep;
  inputValue: string;
  preventFiltering: boolean;
  allowCustomValue: boolean;
  /** Put the custom value first, as for regex operators where typing is the norm. */
  customValueFirst: boolean;
}

/** The rows to show: the matching options plus a "use custom value" row for typed text. */
export function getDropdownItems({
  options,
  step,
  inputValue,
  preventFiltering,
  allowCustomValue,
  customValueFirst,
}: DropdownItemsInput): EditorOption[] {
  const items = searchOptions(options, preventFiltering ? '' : inputValue);
  const typed = inputValue.trim();

  if (!allowCustomValue || step === 'operator' || !typed) {
    return items;
  }

  const hasExactMatch = options.some(
    (option) => option.value === typed || option.label === typed,
  );

  if (hasExactMatch) {
    return items;
  }

  const custom: EditorOption = { value: typed, label: typed, isCustom: true };

  return customValueFirst ? [custom, ...items] : [...items, custom];
}

/** Rough width in px of a line of dropdown text. */
export function estimateTextWidth(text: string): number {
  return text.length * CHAR_WIDTH + ITEM_PADDING * 2;
}

/** Rough dropdown width in px from the longest label or description. */
export function estimateMenuWidth(items: EditorOption[]): number {
  let width = MIN_MENU_WIDTH;

  for (const item of items) {
    let length = item.label.length;
    let charWidth = CHAR_WIDTH;
    const descriptionLength = item.description?.length ?? 0;

    if (length * CHAR_WIDTH < descriptionLength * DESCRIPTION_CHAR_WIDTH) {
      length = descriptionLength;
      charWidth = DESCRIPTION_CHAR_WIDTH;
    }

    if (item.isCustom) {
      length += CUSTOM_PREFIX_LENGTH;
    }

    width = Math.max(width, length * charWidth + ITEM_PADDING * 2);
  }

  return width;
}
