import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { EstadoCrudo } from '../src/lib/esquemaEstado'

/**
 * Lectura de un estado de cuenta del Banco Popular.
 *
 * Los PDF que exporta Popularenlinea son imagenes: se imprimen desde el
 * navegador a 300 dpi y no tienen ni un caracter de texto. No hay nada que
 * parsear, hay que verlos. La API acepta el PDF directamente y se encarga de
 * rasterizar cada pagina, asi que no hace falta convertir nada aqui.
 */

const MODELO = 'claude-opus-5'

const INSTRUCCIONES = `Eres un transcriptor de estados de cuenta del Banco Popular Dominicano.

Tu unico trabajo es COPIAR lo que ves. No interpretas, no normalizas, no corriges.

REGLA MAS IMPORTANTE: EL SIGNO
El Popular escribe el signo en posiciones distintas segun el tipo de estado, y
esa diferencia significa cosas opuestas. Tu NO tienes que resolver eso: copia el
monto exactamente como esta impreso, con el signo en la misma posicion.

  Si en el PDF dice "RD$ 30.00-"      escribe "RD$ 30.00-"     (menos al final)
  Si en el PDF dice "RD$ -15,000.00"  escribe "RD$ -15,000.00" (menos al inicio)
  Si en el PDF dice "RD$ 1,414.99"    escribe "RD$ 1,414.99"   (sin signo)

Nunca muevas el menos de lugar. Nunca lo agregues. Nunca lo quites.
Un menos mal copiado invierte el significado del movimiento.

LAS FECHAS
Copialas tal cual, sin reformatear. Si el PDF dice "24/05/2026" escribe
"24/05/2026". Si dice "2026-07-10" escribe "2026-07-10". En un mismo documento
puede haber los dos formatos, incluso en campos parecidos. No los unifiques.

LAS DESCRIPCIONES
Un concepto puede ocupar dos o tres lineas en la tabla (los LBTR se parten
asi). Unelo todo en una sola linea separando con un espacio. Copia el texto
completo, incluidos numeros de cuenta, asteriscos y codigos de referencia:
hacen falta para emparejar movimientos despues.

EL ORDEN
Transcribe los movimientos en el mismo orden en que aparecen impresos, de
arriba hacia abajo, pagina por pagina. No los ordenes por fecha. En las
tarjetas suelen venir desordenados y asi los quiero.

COMPLETITUD
Transcribe TODOS los movimientos de TODAS las paginas. No resumas, no omitas
lineas repetidas, no agrupes. Si el mismo cargo aparece dos veces el mismo dia,
escribelo dos veces: detectar duplicados es trabajo de otro paso.

QUE ES CADA COSA
- clase "cuenta": encabezado tipo "Cuenta Corriente" o "Cuenta de Ahorros".
  Columnas: Fecha, Comentarios, Monto, Balance, Cheque.
- clase "tarjeta": encabezado "Tarjeta de Credito".
  Columnas: Fecha de transaccion, Fecha de entrada, Descripcion, Monto.
  No trae columna de balance: deja "balance" en null en cada movimiento.

EL RESUMEN
Llena solo los campos que el documento realmente muestre; el resto en null.
En las tarjetas, ojo con la diferencia:
- "Fecha de corte", "Balance al corte", "Pago minimo" y "Fecha vencimiento de
  pago" pertenecen al ciclo que estas leyendo.
- "Balance a la fecha", "Disponible" y "Limite aprobado" son del dia en que se
  imprimio el documento, no del ciclo.
Copia ambos grupos; quien los use sabra separarlos.

PRIVACIDAD
En el campo "ultimos4" pon UNICAMENTE los ultimos cuatro digitos del numero de
cuenta o tarjeta del encabezado. Nunca el numero completo ni el IBAN.

CUANDO NO ESTES SEGURO
No adivines. Si un monto, una fecha o un concepto no se leen con claridad,
transcribe lo que mejor puedas y agrega una linea a "advertencias" diciendo
cual movimiento es y que te genero duda. Es preferible una advertencia a un
numero inventado.`

export interface ResultadoLectura {
  estado: EstadoCrudo
  uso: { entrada: number; salida: number }
}

export async function extraerEstado(pdfBase64: string): Promise<ResultadoLectura> {
  const client = new Anthropic({
    // 10 minutos: un estado de varias paginas escaneadas se toma su tiempo.
    timeout: 10 * 60 * 1000,
  })

  const respuesta = await client.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    system: INSTRUCCIONES,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'high',
      format: zodOutputFormat(EstadoCrudo),
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          {
            type: 'text',
            text: 'Transcribe este estado de cuenta completo, siguiendo las reglas al pie de la letra.',
          },
        ],
      },
    ],
  })

  if (respuesta.stop_reason === 'max_tokens') {
    throw new Error(
      'El estado es demasiado largo para leerlo de una vez. Exporta un rango de fechas más corto desde Popularenlínea y vuelve a subirlo.',
    )
  }

  if (respuesta.stop_reason === 'refusal') {
    throw new Error('La lectura fue rechazada por los filtros de seguridad del modelo.')
  }

  const estado = respuesta.parsed_output
  if (!estado) {
    throw new Error('El modelo no devolvió un resultado con la forma esperada.')
  }

  return {
    estado,
    uso: {
      entrada: respuesta.usage.input_tokens,
      salida: respuesta.usage.output_tokens,
    },
  }
}
