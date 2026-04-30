import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const dbUrl = readFileSync(".env.local","utf-8").split("\n").find(l=>l.startsWith("DATABASE_URL="))?.replace("DATABASE_URL=","").trim();
const sql = neon(dbUrl);

const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='remittance_requests' ORDER BY ordinal_position`;
console.log("Columns:", cols.map(c=>c.column_name).join(", "));
