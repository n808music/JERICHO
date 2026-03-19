const runtimeEnv = (() => {
  if (typeof process !== 'undefined' && process?.env) {
    return process.env;
  }
  if (typeof import.meta !== 'undefined' && import.meta?.env) {
    return import.meta.env;
  }
  return {};
})();

export const IS_PRODUCTION =
  runtimeEnv.NODE_ENV === 'production' || runtimeEnv.MODE === 'production' || runtimeEnv.PROD === true;

export const IS_DEVELOPMENT = !IS_PRODUCTION;

export function getRuntimeEnvValue(name) {
  return runtimeEnv?.[name];
}

export function isRuntimeEnvFlagEnabled(name) {
  const value = getRuntimeEnvValue(name);
  return value === true || value === 'true' || value === 1 || value === '1';
}
