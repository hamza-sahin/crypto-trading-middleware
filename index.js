const express = require('express');
const axios = require('axios');
require('dotenv').config();
const SingletonExchange = require('./SingletonExchange.js')
const binanceClient = SingletonExchange.getBinanceClient();
const app = express();
const PORT = process.env.PORT || 8080;
const Actions = {
    Sell: "sell",
    Buy: "buy"
}

const Types = {
    CloseBuy: "CLOSE_BUY",
    CloseSell: "CLOSE_SELL",
    Sltp: "SLTP",
    Buy: "BUY",
    Sell: "SELL"
}

app.use(express.json());

app.listen(
    PORT,
    () => console.log('listening on port ' + PORT)
);

app.post('/placeorder/:symbol', (req, res) => {
    run(req, res);
    res.sendStatus(200);
});

app.get('/open-positions', async (req, res) => {
    const response = await getOpenPositions();
    res.send(response);
});

app.get('/trades', async (req, res) => {
    const response = await binanceClient.fetchMyTrades();
    res.send(response);
});

const run = async (req, res) => {
    const limitSide = req.body.trade.action == Actions.Buy ? Actions.Sell : Actions.Buy
    const slMultiplier = req.body.trade.action == Actions.Buy ? -1 : 1
    const tpMultiplier = req.body.trade.action == Actions.Buy ? 1 : -1
    const slInPrice = (req.body.trade.entry_price + (req.body.trade.stop_loss * req.body.trade.tick * slMultiplier));
    const tpInPrice = (req.body.trade.entry_price + (req.body.trade.stop_loss * req.body.trade.tick * tpMultiplier));

    const openPositions = await getOpenPositions();

    if (openPositions.length > 0) {
        if (req.body.type === Types.Buy || req.body.type === Types.Sell || req.body.type === Types.Sltp){
            const tasks = [
                binanceClient.createMarketOrder(req.params.symbol, limitSide, req.body.trade.contracts),
                binanceClient.cancelAllOrders(req.params.symbol),
                broadcastMessage(req, 0, 0)
            ];
            await Promise.all(tasks);
            return;
        }
    }
    else if (req.body.type === Types.CloseBuy || req.body.type === Types.CloseSell){
        return;
    }
    
    try {
        // create order only when there is a buy or sell signal
        // otherwise, cancel all open orders
        if (req.body.type === Types.Buy || req.body.type === Types.Sell){
            const tasks = [
                binanceClient.createMarketOrder(req.params.symbol, req.body.trade.action, req.body.trade.contracts),
                binanceClient.createLimitOrder(req.params.symbol, limitSide, req.body.trade.contracts, slInPrice, params = {stopPrice: slInPrice}), 
                binanceClient.createOrder(req.params.symbol, "TAKE_PROFIT", limitSide, req.body.trade.contracts, tpInPrice, params = {stopPrice: tpInPrice}),
                broadcastMessage(req, slInPrice, tpInPrice)
            ];
            await Promise.all(tasks);
        }
        else if (req.body.type === Types.CloseBuy || req.body.type === Types.CloseSell){
            const tasks = [
                binanceClient.createMarketOrder(req.params.symbol, req.body.trade.action, req.body.trade.contracts),
                await binanceClient.cancelAllOrders(req.params.symbol),
                broadcastMessage(req, slInPrice, tpInPrice)
            ];
            await Promise.all(tasks);
        }
        else
        {
            await binanceClient.cancelAllOrders(req.params.symbol);
        }
    } catch (error) {
        console.error(error, "\n TP: " + tpInPrice + "\n SL: " + slInPrice + "\n");
    }
}

const getOpenPositions = async () => {
    const balances = await binanceClient.fetchBalance();
    const openPositions = balances.info.positions.filter(position => position.positionAmt != 0);
    return openPositions
}

const broadcastMessage = async (req, slInPrice, tpInPrice) => {
    const message = req.body.type + " BTC/BUSD " + req.body.trade.contracts + "\n" +
    "Entry Price: " + req.body.trade.entry_price.toFixed(2) + "\n" +
    "SL: " + slInPrice.toFixed(2) + "\n" +
    "TP: " + tpInPrice.toFixed(2) + "\n" +
    "Leverage: " + req.body.trade.leverage;

    try {
        await axios.get("https://api.telegram.org/bot1025461661:AAHMJa3hKCAxk3LT6SqL6ZVubI9-27otJPY/sendMessage?chat_id=-1001625118195&text=" + message);
    } catch (error) {
        console.log(error);        
    }
}