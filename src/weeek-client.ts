const BASE_URL = "https://api.weeek.net/public/v1";

export type Query = Record<string, string | number | boolean | undefined>;
export type JsonBody = Record<string, unknown>;

export interface WeeekClient {
  get(path: string, params?: Query): Promise<unknown>;
  post(path: string, body?: JsonBody): Promise<unknown>;
  put(path: string, body?: JsonBody): Promise<unknown>;
}

export type WeeekClientOptions = {
  token: string;
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
};

export function createWeeekClient(options: WeeekClientOptions): WeeekClient {
  const token = options.token.trim();
  if (!token) throw new Error("Weeek API token must not be empty.");
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const baseUrl = options.baseUrl ?? BASE_URL;

  async function request(
    method: "GET" | "POST" | "PUT",
    requestPath: string,
    body?: JsonBody,
    params?: Query
  ): Promise<unknown> {
    const url = new URL(`${baseUrl}${requestPath}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const response = await fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Weeek API ${method} ${requestPath} failed (${response.status}): ${text}`
      );
    }

    return response.json();
  }

  return {
    get(path, params) {
      return request("GET", path, undefined, params);
    },
    post(path, body) {
      return request("POST", path, body);
    },
    put(path, body) {
      return request("PUT", path, body);
    },
  };
}
