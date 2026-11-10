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
export declare function createWeeekClient(options: WeeekClientOptions): WeeekClient;
