const express = require('express');
const socket = require('ws');

const app = express();

const server = app.listen(8000, () => {
	console.log("Bitfinex is listening at /bitfinex");
	console.log("Coinbase is listening at /coinbase");
});

// Global variables
let ws; // Websocket
let response; // Data pulled from websocket
let type; // Type of response ie.) update, snapshot
let price;
let count;
let amount;
let transaction; // Bid or Ask
let update; // object that will be parsed to be added into db
let changes; // Coinbase's updates are referred to as changes on their api


// bitfinex
app.use('/bitfinex', () => {
	const bitfinex = 'wss://api.bitfinex.com/ws';
	ws = new socket(bitfinex);

	ws.on('open', () => {
		ws.send(JSON.stringify({
			'event': 'subscribe',
			"channel":"book",
			'pair': 'BTCUSD',
			'prec': 'P0'
		}));
	});

	ws.on('message', (msg) => {
		response = JSON.parse(msg);

		// check if 'bid' or 'ask'
		if(response[3] > 0) {
			transaction = "Bid";
		} else if(response[3] < 0) {
			transaction = "Ask";
		};

		// logging to see correctly parsed
		update = {
			exchange: 'Bitfinex',
			type: 'Updates',
			price: response[1],
			count: response[2],
			amount: response[3],
			transaction: transaction
		};

		// check if snapshot or update
		if(update.transaction == undefined) {
			// if update is a snapshot, we will not print anything
			update = {
				exchange: 'Bitfinex',
				type: 'Snapshot'
			}
		};

		console.log(update);
		// TODO: Save the object into mysql
	});
});

// coinbase
app.use('/coinbase', () => {
	const coinbase = 'wss://ws-feed.gdax.com';
	ws = new socket(coinbase);

	ws.on('open', () => {
		ws.send(JSON.stringify({
			'type': 'subscribe',
			'product_ids': [
				'BTC-USD'
			],
			'channels': [
				'level2'
			]
		}));
	});

	ws.on('message', (msg) => {
		response = JSON.parse(msg);

		// Updates
		if(response.type == 'l2update') {
			changes = response.changes;

			changes.forEach((data) => {
				update = {
					exchange: 'Coinbase',
					type: 'Updates',
					transaction: data[0],
					price: data[1],
					amount: data[2]
					}
			});
			console.log(update);
		};

		// TODO: Save into mysql database
	});

});
