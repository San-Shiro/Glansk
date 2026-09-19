export interface AppConfig {
  host: string;
  port: number;
  dataDirectory: string;
}

export function loadConfig(environment: Record<string, string | undefined> = process.env): AppConfig {
  const defaultPort = 38490;
  const rawPort = environment.PORT ?? environment.GLANSK_PORT ?? defaultPort;
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("GLANSK_PORT must be a valid TCP port");
  return {
    host: environment.HOST ?? environment.GLANSK_HOST ?? "127.0.0.1",
    port,
    dataDirectory: environment.DATA_DIR ?? environment.GLANSK_DATA_DIR ?? "runtime/data",
  };
}
