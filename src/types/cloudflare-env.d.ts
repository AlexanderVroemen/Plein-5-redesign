interface Env {
  ADMIN_PASSWORD?: string;
  PLEIN5_MENU?: KVNamespace;
}

declare namespace App {
  interface Locals {
    runtime?: {
      env?: Env;
    };
  }
}
