import { defineFunction, secret } from "@aws-amplify/backend";

export const migrateUser = defineFunction({
  name: "migrate-user",
  entry: "./handler.ts",
  timeoutSeconds: 10,
  resourceGroupName: "auth",
  environment: {
    DATABASE_URL: secret("DATABASE_URL"),
  },
});
