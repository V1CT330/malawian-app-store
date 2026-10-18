import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";

const DIDIT_SESSION_ENDPOINT = "https://verification.didit.me/v3/session/";
const DIDIT_HOSTED_HOSTS = new Set(["verify.didit.me"]);

export const Route = createFileRoute("/api/public/didit/session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.DIDIT_API_KEY;
        const workflowId = process.env.DIDIT_WORKFLOW_ID;
        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const publishableKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!apiKey || !workflowId || !supabaseUrl || !publishableKey) {
          console.error("Didit session creation is missing server configuration.", {
            apiKeyConfigured: Boolean(apiKey),
            workflowConfigured: Boolean(workflowId),
            supabaseConfigured: Boolean(supabaseUrl && publishableKey),
          });
          return Response.json(
            { error: "Automatic verification is not configured yet. Please use manual verification or try again later." },
            { status: 503 },
          );
        }

        const authorization = request.headers.get("authorization") ?? "";
        const tokenMatch = /^Bearer\s+(.+)$/i.exec(authorization);
        if (!tokenMatch?.[1]) {
          return Response.json({ error: "Please sign in to start verification." }, { status: 401 });
        }

        const authClient = createClient(supabaseUrl, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: authData, error: authError } = await authClient.auth.getUser(tokenMatch[1]);
        if (authError || !authData.user) {
          return Response.json({ error: "Your session has expired. Sign in again and retry." }, { status: 401 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("id, is_developer, kyc_status")
            .eq("id", authData.user.id)
            .maybeSingle();

          if (profileError) {
            console.error("Could not load developer profile for Didit session.", {
              code: profileError.code,
            });
            return Response.json({ error: "Could not load your developer profile. Please try again." }, { status: 500 });
          }
          if (!profile || profile.is_developer !== true) {
            return Response.json({ error: "Only developer accounts can start identity verification." }, { status: 403 });
          }
          if (profile.kyc_status === "approved") {
            return Response.json({ error: "Your identity is already verified." }, { status: 409 });
          }

          const configuredAppUrl = process.env.APP_URL?.trim();
          const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
          const callbackOrigin = configuredAppUrl
            ? new URL(configuredAppUrl).origin
            : productionHost
              ? `https://${productionHost}`
              : new URL(request.url).origin;
          const callback = new URL("/console/verification?didit=return", callbackOrigin).toString();

          const diditResponse = await fetch(DIDIT_SESSION_ENDPOINT, {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              workflow_id: workflowId,
              vendor_data: authData.user.id,
              callback,
              callback_method: "both",
            }),
            signal: AbortSignal.timeout(15000),
          });

          if (!diditResponse.ok) {
            // Do not log request/response bodies: they can contain sensitive provider data.
            console.error("Didit session creation failed.", { status: diditResponse.status });
            return Response.json(
              { error: "Didit could not start verification. Please try again or use manual verification." },
              { status: 502 },
            );
          }

          const session = (await diditResponse.json()) as {
            session_id?: unknown;
            url?: unknown;
          };
          if (typeof session.url !== "string" || typeof session.session_id !== "string") {
            console.error("Didit returned an incomplete session response.");
            return Response.json({ error: "Didit returned an invalid session. Please try again." }, { status: 502 });
          }

          const verificationUrl = new URL(session.url);
          if (
            verificationUrl.protocol !== "https:" ||
            (!DIDIT_HOSTED_HOSTS.has(verificationUrl.hostname) &&
              !verificationUrl.hostname.endsWith(".didit.me"))
          ) {
            console.error("Didit returned an unexpected hosted verification URL.");
            return Response.json({ error: "Didit returned an unexpected verification link." }, { status: 502 });
          }

          return Response.json({
            session_id: session.session_id,
            url: verificationUrl.toString(),
          });
        } catch (error) {
          console.error("Unexpected error creating Didit session.", {
            message: error instanceof Error ? error.message : "Unknown error",
          });
          return Response.json(
            { error: "Could not start automatic verification. Please try again or use manual verification." },
            { status: 500 },
          );
        }
      },
    },
  },
});
