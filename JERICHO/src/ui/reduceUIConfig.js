// Single feature flag to reduce/hide non-essential UI for freeze certification.
// Enable by setting VITE_REDUCE_UI=1 in the environment or build config.
export const REDUCE_UI = typeof process !== 'undefined' && !!process.env?.VITE_REDUCE_UI;

export default REDUCE_UI;
