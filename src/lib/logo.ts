/*
 * TrendTracker mark: the "github-alt" cat from Font Awesome Free (CC BY 4.0,
 * https://fontawesome.com/license/free), split into its parts and layered for depth:
 * soft shadow, extruded edge, gradient head, recessed face, glossy eyes and a highlight.
 */

/** Outline of the head, ears included (512×512 grid). */
const HEAD =
  "M496 278.2c0 31.9-3.2 65.7-17.5 95-37.9 76.6-142.1 74.8-216.7 74.8-75.8 0-186.2 2.7-225.6-74.8-14.6-29-20.2-63.1-20.2-95 0-41.9 13.9-81.5 41.5-113.6-5.2-15.8-7.7-32.4-7.7-48.8 0-21.5 4.9-32.3 14.6-51.8 45.3 0 74.3 9 108.8 36 29-6.9 58.8-10 88.7-10 27 0 54.2 2.9 80.4 9.2 34-26.7 63-35.2 107.8-35.2 9.8 19.5 14.6 30.3 14.6 51.8 0 16.4-2.6 32.7-7.7 48.2 27.5 32.4 39 72.3 39 114.2z";
/** The face opening. */
const FACE =
  "M431.7 328.7c0-43.9-26.7-82.6-73.5-82.6-18.9 0-37 3.4-56 6-14.9 2.3-29.8 3.2-45.1 3.2-15.2 0-30.1-.9-45.1-3.2-18.7-2.6-37-6-56-6-46.8 0-73.5 38.7-73.5 82.6 0 87.8 80.4 101.3 150.4 101.3l48.2 0c70.3 0 150.6-13.4 150.6-101.3z";
const LEFT_EYE =
  "M202.1 328.7c0 20.9-10.9 55.1-36.7 55.1s-36.7-34.2-36.7-55.1 10.9-55.1 36.7-55.1 36.7 34.2 36.7 55.1z";
const RIGHT_EYE =
  "M349.1 273.6c-25.8 0-36.7 34.2-36.7 55.1s10.9 55.1 36.7 55.1 36.7-34.2 36.7-55.1-10.9-55.1-36.7-55.1z";

export interface LogoPalette {
  /** Head gradient, top to bottom. */
  head: [string, string, string];
  /** Extruded edge under the head. */
  edge: [string, string];
  /** Inside of the face, top (in shadow) to bottom (lit). */
  face: [string, string];
  /** Eyes, top to bottom. */
  eyes: [string, string];
  shadow: string;
}

export const LOGO_PALETTE: LogoPalette = {
  head: ["#8ff0a0", "#3fb950", "#1a7f37"],
  edge: ["#116329", "#0b4a1f"],
  face: ["#c6efcf", "#f6fff8"],
  eyes: ["#1f883d", "#0b4a1f"],
  shadow: "#0b4a1f",
};

/**
 * The mark as standalone SVG markup. `id` prefixes gradient and filter ids so several
 * copies can live on one page.
 */
export function logoSvg({
  id = "tt",
  palette = LOGO_PALETTE,
  size,
}: { id?: string; palette?: LogoPalette; size?: number } = {}) {
  const p = palette;
  const dims = size ? ` width="${size}" height="${size}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 16 512 480"${dims} aria-hidden="true">
<defs>
<linearGradient id="${id}-head" x1="0" y1="64" x2="0" y2="448" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${p.head[0]}"/><stop offset=".45" stop-color="${p.head[1]}"/><stop offset="1" stop-color="${p.head[2]}"/></linearGradient>
<linearGradient id="${id}-edge" x1="0" y1="200" x2="0" y2="470" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${p.edge[0]}"/><stop offset="1" stop-color="${p.edge[1]}"/></linearGradient>
<linearGradient id="${id}-face" x1="0" y1="246" x2="0" y2="430" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${p.face[0]}"/><stop offset=".35" stop-color="${p.face[1]}"/></linearGradient>
<linearGradient id="${id}-eye" x1="0" y1="273" x2="0" y2="384" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${p.eyes[0]}"/><stop offset="1" stop-color="${p.eyes[1]}"/></linearGradient>
<linearGradient id="${id}-gloss" x1="0" y1="64" x2="0" y2="250" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="${id}-rim" x1="0" y1="64" x2="0" y2="300" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<filter id="${id}-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
<clipPath id="${id}-clip"><path d="${HEAD}"/></clipPath>
</defs>
<path d="${HEAD}" transform="translate(0 30)" fill="${p.shadow}" opacity=".35" filter="url(#${id}-blur)"/>
<path d="${HEAD}" transform="translate(0 16)" fill="url(#${id}-edge)"/>
<path d="${HEAD}" fill="url(#${id}-head)"/>
<g clip-path="url(#${id}-clip)">
<ellipse cx="256" cy="120" rx="250" ry="130" fill="url(#${id}-gloss)"/>
<path d="${HEAD}" fill="none" stroke="url(#${id}-rim)" stroke-width="18"/>
</g>
<path d="${FACE}" transform="translate(0 -6)" fill="${p.edge[1]}" opacity=".55"/>
<path d="${FACE}" fill="url(#${id}-face)"/>
<path d="${LEFT_EYE}" fill="url(#${id}-eye)"/>
<path d="${RIGHT_EYE}" fill="url(#${id}-eye)"/>
<ellipse cx="179" cy="303" rx="11" ry="15" fill="#fff" opacity=".9"/>
<ellipse cx="363" cy="303" rx="11" ry="15" fill="#fff" opacity=".9"/>
</svg>`;
}
