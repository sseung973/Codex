/** Original screen-space game optics; decorative ticks are not ballistic calibration. */
export function sightMarkup(): string {
  const ticks = Array.from({ length: 8 }, (_, i) => {
    const d = 8 + i * 6;
    return [-1, 1]
      .map(
        (sign) =>
          `<path d="M ${100 + sign * d} 98 v 4 M 98 ${100 + sign * d} h 4"/>`,
      )
      .join("");
  }).join("");
  return `<div class="reflex-glass"><span class="reflex-dot"></span><span class="reflex-ring"></span></div><div class="reflex-base"><i></i></div><svg class="scope-glass" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="98" fill="none" stroke="currentColor" stroke-width="1"/><g fill="none" stroke="currentColor"><path d="M 100 1 V 57 M 100 143 V 199 M 1 100 H 57 M 143 100 H 199" stroke-width="3"/><path d="M 57 100 H 143 M 100 57 V 143" stroke-width=".45"/><g stroke-width=".55">${ticks}</g></g><circle cx="100" cy="100" r=".65" fill="currentColor"/></svg>`;
}
