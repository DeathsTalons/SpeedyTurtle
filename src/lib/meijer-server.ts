import "server-only";
import { MeijerClient } from "@/lib/meijer";

let client: MeijerClient | null = null;
export const meijer = () => (client ??= MeijerClient.fromEnv());
