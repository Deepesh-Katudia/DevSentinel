export function buildGithubAppInstallUrl(appName: string, orgId: string) {
  if (!orgId) {
    throw new Error("GitHub install URL requires an organisation id");
  }
  const url = new URL(`https://github.com/apps/${appName}/installations/new`);
  url.searchParams.set("state", orgId);
  return url.toString();
}
