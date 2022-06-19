const ccxt = require('ccxt');
let binanceClient = null

class SingletonExchangeClass {
    static getBinanceClient() {
        if(!binanceClient) {
            binanceClient = new ccxt.binanceusdm({
                apiKey: process.env.API_KEY,
                secret: process.env.API_SECRET,
                enableRateLimit: true,
                options: {
                    defaultType: 'future',
                    adjustForTimeDifference: true,
                    recvWindow: 60000
                },
            });
            binanceClient.setSandboxMode(true); 
            binanceClient.loadMarkets();
        }
        return binanceClient
    }
}

module.exports = SingletonExchangeClass