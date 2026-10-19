import { spawn } from "node:child_process";
import process from "node:process";

const STRIPE_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
].join(",");

const children = new Set();
let shuttingDown = false;

try {
  process.loadEnvFile();
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const stopChildren = (signal = "SIGTERM") => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
};

process.once("SIGINT", () => stopChildren("SIGINT"));
process.once("SIGTERM", () => stopChildren("SIGTERM"));

const startApplication = (extraEnv = {}) => {
  const child = spawn("vp", ["run", "--filter", "./apps/*", "dev"], {
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  });
  children.add(child);
  child.once("exit", (code, signal) => {
    children.delete(child);
    stopChildren();
    if (signal) process.kill(process.pid, signal);
    process.exitCode = code ?? 1;
  });
  child.once("error", (error) => {
    console.error("Não foi possível iniciar a aplicação:", error.message);
    stopChildren();
    process.exitCode = 1;
  });
};

if (process.env.BILLING_ENABLED !== "true") {
  startApplication();
} else {
  const stripe = spawn(
    "stripe",
    [
      "listen",
      "--events",
      STRIPE_EVENTS,
      "--forward-to",
      "http://localhost:3001/api/billing/webhooks/stripe",
    ],
    { env: process.env, stdio: ["inherit", "pipe", "pipe"] },
  );
  children.add(stripe);

  let applicationStarted = false;
  let output = "";
  const handleStripeOutput = (chunk, destination) => {
    destination.write(chunk);
    if (applicationStarted) return;
    output = `${output}${chunk}`.slice(-16_384);
    const secret = output.match(/whsec_[A-Za-z0-9]+/)?.[0];
    if (!secret) return;
    applicationStarted = true;
    console.log("\nStripe conectado. Iniciando a aplicação com o segredo local do webhook.\n");
    startApplication({ STRIPE_WEBHOOK_SECRET: secret });
  };

  stripe.stdout.on("data", (chunk) => handleStripeOutput(chunk, process.stdout));
  stripe.stderr.on("data", (chunk) => handleStripeOutput(chunk, process.stderr));
  stripe.once("error", (error) => {
    console.error(
      "Não foi possível iniciar o Stripe CLI. Instale-o e execute `stripe login` antes de `vp run dev`:",
      error.message,
    );
    stopChildren();
    process.exitCode = 1;
  });
  stripe.once("exit", (code, signal) => {
    children.delete(stripe);
    if (!shuttingDown) {
      console.error(
        applicationStarted
          ? "O listener local do Stripe foi encerrado; encerrando a aplicação para evitar webhooks inválidos."
          : "O Stripe CLI encerrou antes de fornecer o segredo local do webhook.",
      );
      stopChildren();
      if (signal) process.kill(process.pid, signal);
      process.exitCode = code ?? 1;
    }
  });
}
