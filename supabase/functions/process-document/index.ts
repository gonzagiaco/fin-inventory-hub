import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PYTHON_BACKEND_URL = "https://normalizador-327794609851.us-central1.run.app";

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const supplierId = formData.get("supplierId") as string;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Forward to Python backend
    const pythonFormData = new FormData();
    pythonFormData.append("file", file);

    const response = await fetch(`${PYTHON_BACKEND_URL}/procesar/${supplierId}`, {
      method: "POST",
      body: pythonFormData,
    });

    if (!response.ok) {
      throw new Error(`Python backend error: ${response.statusText}`);
    }

    const result = await response.json();

    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error processing document:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to process document";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
