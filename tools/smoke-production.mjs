const TIMEOUT_MS = 15_000;

const requiredUrl = (name) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value.replace(/\/$/, "");
};

const checkedFetch = async (url, expectedContentType) => {
  const response = await fetch(url, {
    headers: { "user-agent": "lazuli-deployment-smoke/1.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes(expectedContentType)) {
    throw new Error(`${url} returned unexpected content type: ${contentType || "missing"}.`);
  }

  return response;
};

const apiUrl = requiredUrl("API_URL");
const websiteUrl = requiredUrl("WEBSITE_URL");

const healthResponse = await checkedFetch(`${apiUrl}/api/health`, "application/json");
const health = await healthResponse.json();

if (health.status !== "ok" || health.appName !== "Lazúli") {
  throw new Error("The API health response does not identify a healthy Lazúli service.");
}

await checkedFetch(`${websiteUrl}/login`, "text/html");

console.log("Production smoke test passed for API and website.");
