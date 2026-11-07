export const SETTINGS_KEY = "trendtracker:settings:v1";

/**
 * Runs inline in <head> before first paint: resolves the theme so the page never
 * flashes the wrong colours. Kept in sync with `applyTheme` below.
 */
export const THEME_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem("${SETTINGS_KEY}")||"{}");var t=s.theme||"system";if(t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}})()`;
