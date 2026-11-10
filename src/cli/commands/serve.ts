import type { CliFlags } from "../args.js";
import { serve } from "../../server/serve.js";

export async function runServeCommand(flags: CliFlags): Promise<void> {
  const config = typeof flags.config === "string" ? flags.config : undefined;
  await serve({ configPath: config, allowLegacyEnv: true });
}
