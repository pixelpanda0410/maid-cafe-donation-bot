import "reflect-metadata";
import { Server } from "./server";

async function main() {
  const server = new Server();
  await server.init();
  await server.up();
}

main().catch((error) => {
  console.error(error);
});
