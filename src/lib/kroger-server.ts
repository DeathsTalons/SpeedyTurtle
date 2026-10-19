import "server-only";
import { KrogerClient } from "@/lib/kroger";

// One shared client per server instance so the access token is reused between requests.
let client: KrogerClient | null = null;
export const kroger = () => (client ??= KrogerClient.fromEnv());
