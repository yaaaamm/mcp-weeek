import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
export function createPrompt() {
    const readline = createInterface({ input: stdin, output: stdout });
    return {
        async ask(message, defaultValue) {
            const suffix = defaultValue ? ` [${defaultValue}]` : "";
            const answer = (await readline.question(`${message}${suffix}: `)).trim();
            return answer || defaultValue || "";
        },
        async confirm(message, defaultValue = false) {
            const hint = defaultValue ? "Y/n" : "y/N";
            const answer = (await readline.question(`${message} [${hint}]: `)).trim().toLowerCase();
            if (!answer)
                return defaultValue;
            return answer === "y" || answer === "yes" || answer === "да";
        },
        close() {
            readline.close();
        },
    };
}
