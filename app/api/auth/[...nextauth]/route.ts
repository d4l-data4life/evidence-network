// Auth.js catch-all route handler — wires GET/POST for sign-in, callbacks,
// sign-out, session, etc. under /api/auth/*.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
