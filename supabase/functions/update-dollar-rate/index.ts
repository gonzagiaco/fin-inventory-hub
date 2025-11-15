import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DOLAR_API_URL = "https://dolarapi.com/v1/dolares/oficial"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔄 Iniciando actualización del dólar oficial...')

    // 1. Obtener cotización de API externa
    const response = await fetch(DOLAR_API_URL)
    if (!response.ok) {
      throw new Error(`Error HTTP al llamar DolarApi: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('📊 Cotización obtenida:', data)
    
    // 2. Extraer datos relevantes
    const dollarData = {
      rate: data.venta, // Valor principal para conversión
      venta: data.venta,
      compra: data.compra,
      source: 'dolarapi.com',
      fechaActualizacion: data.fechaActualizacion || new Date().toISOString(),
    }

    // 3. Usar service role key para bypasear RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. Actualizar settings en la base de datos
    const { error } = await supabaseAdmin
      .from('settings')
      .upsert({
        key: 'dollar_official',
        value: dollarData,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      console.error('❌ Error al guardar en Supabase:', error)
      throw error
    }

    console.log('✅ Valor de dólar oficial actualizado correctamente')
    console.log(`💵 Nuevo valor: $${dollarData.rate}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: dollarData,
        message: `Dólar actualizado: $${dollarData.rate}`,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (err) {
    console.error('❌ Error actualizando dólar oficial:', err)
    
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
    const errorDetails = err instanceof Error ? err.toString() : String(err)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        details: errorDetails,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
