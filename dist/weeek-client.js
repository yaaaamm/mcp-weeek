const BASE_URL = "https://api.weeek.net/public/v1";
export function createWeeekClient(options) {
    const token = options.token.trim();
    if (!token)
        throw new Error("Weeek API token must not be empty.");
    const fetchImpl = options.fetch ?? globalThis.fetch;
    const baseUrl = options.baseUrl ?? BASE_URL;
    async function request(method, requestPath, body, params) {
        const url = new URL(`${baseUrl}${requestPath}`);
        for (const [key, value] of Object.entries(params ?? {})) {
            if (value !== undefined)
                url.searchParams.set(key, String(value));
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
            throw new Error(`Weeek API ${method} ${requestPath} failed (${response.status}): ${text}`);
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
