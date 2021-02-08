import * as https from 'https'
import {client as WebSocketClient} from 'websocket'
import {stdout} from 'process'

const coinbaseApiURL = 'https://api.pro.coinbase.com'
const binanceApiURL = 'https://api.binance.com'

/** A type guard for removing null values. */
const isNotNull = <T>(value: T | null | undefined): value is T => value != null

/** Ticker data from Coinbase. */
interface CoinbaseTickerData {
  type: 'ticker'
  product_id: string
  price: string
}

/**
 * Check if a value is a Coinbase ticker object.
 */
const isCoinbaseTickerData = (value: unknown): value is CoinbaseTickerData =>
  typeof value === 'object'
  && value !== null
  && (value as any).type === 'ticker'
  && typeof (value as any).product_id === 'string'
  && typeof (value as any).price === 'string'

/**
 * Get Coinbase exchange rates for product IDs like 'BTC-GBP'.
 */
const getCoinbasePriceData = (productIds: string[]) => {
  const tickerData: {[productId: string]: CoinbaseTickerData} = {}
  const client = new WebSocketClient()

  return new Promise<CoinbaseTickerData[]>((resolve, reject) => {
    client.on('connect', connection => {
      const config = {
        type: 'subscribe',
        product_ids: productIds,
        channels: ['ticker'],
      }

      connection.on('error', error => {
        connection.close()

        reject(error)
      })

      connection.on('message', message => {
        if (message.type === 'utf8') {
          const data = JSON.parse(message.utf8Data as string)

          if (isCoinbaseTickerData(data)) {
            tickerData[data.product_id] = data

            if (Object.keys(tickerData).length === productIds.length) {
              connection.close()

              resolve(Object.values(tickerData))
            }
          }
        }
      })

      connection.send(JSON.stringify(config))
    })

    client.connect('wss://ws-feed.pro.coinbase.com')
  })
}

/** Ticker data from Binance */
interface BinanceTickerData {
  symbol: string
  price: string
}

/** Check if a value is a Binance ticker object. */
const isBinanceTickerData = (value: unknown): value is BinanceTickerData =>
  typeof value === 'object'
  && value !== null
  && typeof (value as any).symbol === 'string'
  && typeof (value as any).price === 'string'

/**
 * Get Binance exchange rates for product IDs like 'ADABTC', with a replacement
 * string for the values like 'ADA-BTC' to fit Coinbase's format.
 */
const getBinancePriceData = async (productIds: [string, string][]): Promise<BinanceTickerData[]> => {
  return new Promise<BinanceTickerData[]>((resolve, reject) => {
    https.get(
      `${binanceApiURL}/api/v3/ticker/price`,
      res => {
        let body = ''

        res.on('data', chunk => { body += chunk })
        res.on('end', () => {
          const json = JSON.parse(body)

          if (Array.isArray(json) && json.every(isBinanceTickerData)) {
            resolve(
              json
                .map(({symbol, price}) => {
                  const idPair = productIds.find(x => x[0] === symbol)

                  if (idPair) {
                    // Replace the original symbols with our own symbol,
                    // so they are more human-readable.
                    return {symbol: idPair[1], price}
                  }

                  return null
                })
                .filter(isNotNull)
            )
          } else {
            reject(new Error('Invalid JSON response data'))
          }
        })
      }
    )
  })
}

/**
 * Get exchange rates from cryptocurrency exchanges and print them as CSV.
 */
const printExchangeRates = async (): Promise<void> => {
  const [coinbaseResults, binanceResults] = await Promise.all([
    getCoinbasePriceData([
      'XTZ-GBP',
      'LINK-GBP',
      'BTC-GBP',
    ]),
    getBinancePriceData([
      ['ADABTC', 'ADA-BTC'],
      ['DOTBTC', 'DOT-BTC'],
    ]),
  ])

  const lines: string[] = [
    ...binanceResults
      .map(({symbol, price}) => `Binance,${symbol},${price}\n`),
    ...coinbaseResults
      .map(({product_id, price}) => `Coinbase,${product_id},${price}\n`),
  ]
  lines.sort()

  stdout.write('Exchange,Market,Price\n')
  lines.forEach(line => { stdout.write(line) })
}

printExchangeRates()
  .catch(err => console.error(err))
