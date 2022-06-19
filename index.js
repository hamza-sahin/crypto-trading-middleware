const express = require('express');
const ccxt = require('ccxt');
const axios = require('axios');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 8080;
const Actions = {
    Sell: "sell",
    Buy: "buy"
}

const tick = 0.01;

const Types = {
    CloseBuy: "CLOSE_BUY",
    CloseSell: "CLOSE_SELL",
    Sltp: "SLTP",
    Buy: "BUY",
    Sell: "SELL"
}

const run = async (request, res) => {
    const binanceClient = new ccxt.binanceusdm({
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

    const openPositions = await getOpenPositions(binanceClient);

    if (openPositions.length > 0) {
        if (request.type === Types.Buy || request.type === Types.Sell){
            const limitSide = request.trade.action == Actions.Buy ? Actions.Sell : Actions.Buy
            const tasks = [
                binanceClient.cancelAllOrders("BTCBUSD"),
                binanceClient.createMarketOrder("BTCBUSD", limitSide, request.trade.contracts)
            ];
            await Promise.all(tasks);
        
            return;
        }
    }
    else if (request.type === Types.CloseBuy || request.type === Types.CloseSell){
        return;
    }
    
    const limitSide = request.trade.action == Actions.Buy ? Actions.Sell : Actions.Buy
    const slMultiplier = request.trade.action == Actions.Buy ? -1 : 1
    const tpMultiplier = request.trade.action == Actions.Buy ? 1 : -1
    const slInPrice = (request.trade.entry_price + (request.trade.stop_loss * tick * slMultiplier));
    const tpInPrice = (request.trade.entry_price + (request.trade.stop_loss * tick * tpMultiplier));
    
    const tasks = [
        binanceClient.createMarketOrder("BTCBUSD", request.trade.action, request.trade.contracts)
    ];

    if (request.type === Types.Buy || request.type === Types.Sell){
        tasks.push(
            binanceClient.createLimitOrder("BTCBUSD", limitSide, request.trade.contracts, slInPrice, params = {stopPrice: slInPrice}), 
            binanceClient.createOrder("BTCBUSD", "TAKE_PROFIT", limitSide, request.trade.contracts, tpInPrice, params = {stopPrice: tpInPrice})
        )
    }
    else {
        tasks.push(binanceClient.cancelAllOrders("BTCBUSD"))
    }

    await Promise.all(tasks);

    const message = request.type + " BTC/BUSD " + request.trade.contracts + "\n" +
    "Entry Price: " + request.trade.entry_price.toFixed(2) + "\n" +
    "SL: " + slInPrice.toFixed(2) + "\n" +
    "TP: " + tpInPrice.toFixed(2) + "\n" +
    "Leverage: " + request.trade.leverage;
    await axios.get("https://api.telegram.org/bot1025461661:AAHMJa3hKCAxk3LT6SqL6ZVubI9-27otJPY/sendMessage?chat_id=-1001625118195&text=" + message);
}

const getOpenPositions = async (binanceClient) => {
    const balances = await binanceClient.fetchBalance();
    const openPositions = balances.info.positions.filter(position => position.positionAmt != 0);
    return openPositions
}

app.use(express.json());

app.listen(
    PORT,
    () => console.log('listening on port ' + PORT)
);

app.post('/placeorder', (req, res) => {
    run(req.body, res);
    res.sendStatus(200);
});

app.get('/open-positions', async (req, res) => {
    const binanceClient = new ccxt.binanceusdm({
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

    const response = await getOpenPositions(binanceClient);
    res.send(response);
});