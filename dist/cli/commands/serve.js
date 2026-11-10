import { serve } from "../../server/serve.js";
export async function runServeCommand(flags) {
    const config = typeof flags.config === "string" ? flags.config : undefined;
    await serve({ configPath: config, allowLegacyEnv: true });
}
