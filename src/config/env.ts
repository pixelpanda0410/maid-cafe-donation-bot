import { ImsafuOptions } from "../imsafu";

interface Config {
  debug: boolean;
  server: ServerConfig;
  imsafu: ImsafuOptions;
  merchant: MerchantConfig;
}

interface ServerConfig {
  port: number;
  dbPath: string;
  botToken: string;
  webhookDomain: string;
}

interface MerchantConfig {
  brand: string;
  redirectURL: string;
}

export const ENVS: Config = JSON.parse(process.env.CONFIG_JSON ?? "{}");

function checkEnv() {
  if (Object.entries(ENVS).length === 0) {
    throw new Error("CONFIG_JSON is not provided.");
  }
  Object.entries(ENVS).forEach(([key, value]) => {
    if (!value) {
      throw new Error(`${key} is not provided.`);
    }
  });
}
checkEnv();
