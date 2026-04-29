// Side-effect-only module: loads env vars before any other import that needs
// them. Import this FIRST in any script that touches the database.
//
// Order matters: ES imports are hoisted, so a script can't call dotenv inline
// and have it run before downstream imports execute. Putting the dotenv calls
// in this file and importing it before any DB-touching module works because
// imports are resolved in source order, depth-first.

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" }); // Next.js convention; preferred
loadEnv(); // .env as fallback for CI / non-Next contexts
