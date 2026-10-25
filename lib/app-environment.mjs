// Only explicit test environments may expose local simulation controls.
// Missing configuration is allowed for development, but fails closed in a build.
export function testToolsEnabled(environment, nodeEnvironment) {
  return environment === 'staging' || environment === 'local' ||
    (!environment && nodeEnvironment === 'development');
}
