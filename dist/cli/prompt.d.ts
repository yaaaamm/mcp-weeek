export interface Prompt {
    ask(message: string, defaultValue?: string): Promise<string>;
    confirm(message: string, defaultValue?: boolean): Promise<boolean>;
    close?(): void;
}
export declare function createPrompt(): Prompt;
