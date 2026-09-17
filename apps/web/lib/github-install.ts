export function buildGithubAppInstallUrl(appName: string, orgId: string) {
  const url = new URL(`https://github.com/apps/${appName}/installations/new`);
  url.searchParams.set("state", orgId);
  return url.toString();
}
