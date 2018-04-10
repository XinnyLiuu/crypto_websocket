const express = require('express');
const socket = require('ws');
const mysql = require('mysql');

const app = express();

// Express server
const server = app.listen(8000, () => {
	console.log("Consolidated order book from Bitfinex and Coinbase at /order_book");
});

// MySql Connection
let sql; // variable for all sql queries

const db = mysql.createConnection({
	host: 'localhost',
	user: 'root',
	password: '12345',
	database: 'ws_data'
});

db.connect((err, result) => {
	if(err) {
		console.log(err);
	} else {
		console.log('Connected to Database');
	}
});

// Create db
app.get('/create_db',  (req, res) => {
	sql = 'CREATE DATABASE ws_data';
	db.query(sql, (err, result) => {
		if(err) {
			console.log(err);
		} else {
			console.log(result)
			res.send('Database created');
		}
	});
});

// Create table
app.get('/create_table', (req, res) => {
	sql = 'CREATE TABLE order_book (exchange VARCHAR (225), type VARCHAR (255), transaction VARCHAR (255), price INT (255), amount INT (225))';
	db.query(sql, (err, result) => {
		if(err) {
			console.log(err);
		} else {
			console.log(result);
			res.send('Table created');
		}
	});
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

app.use('/order_book', () => {
	const bitfinex = 'wss://api.bitfinex.com/ws';
	const coinbase = 'wss://ws-feed.gdax.com';

	a = new socket(bitfinex);
	b = new socket(coinbase);

	/**
	 	Bitfinex Websocket
	**/
	a.on('open', () => {
		a.send(JSON.stringify({
			'event': 'subscribe',
			"channel":"book",
			'pair': 'BTCUSD',
			'prec': 'P0'
		}));
	});

	a.on('message', (msg) => {
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
			transaction: transaction,
			price: response[1],
			amount: response[3],
		};

		// check if snapshot or update
		if(update.transaction == undefined) {
			// if update is a snapshot, we will not print anything
			update = {
				exchange: 'Bitfinex',
				type: 'Snapshot'
			}
		};

		// add updates to mysql
		sql = 'INSERT INTO order_book (exchange, type, transaction, price, amount) VALUES ?';
		updateArray = [
			[
				update.exchange,
				update.type,
				update.transaction,
				update.price,
				update.amount
			]
		];
		db.query(sql, [updateArray], (err, result) => {
			if(err) console.log(err);
				console.log(result);
		});
	});

	/**
	 	Coinbase Websocket
	**/
	b.on('open', () => {
		b.send(JSON.stringify({
			'type': 'subscribe',
			'product_ids': [
				'BTC-USD'
			],
			'channels': [
				'level2'
			]
		}));
	});

	b.on('message', (msg) => {
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
				};
			});

			// add updates to mysql
			sql = 'INSERT INTO order_book (exchange, type, transaction, price, amount) VALUES ?';
			updateArray = [
				[
					update.exchange,
					update.type,
					update.transaction,
					update.price,
					update.amount
				]
			];
			db.query(sql, [updateArray], (err, result) => {
				if(err) console.log(err);
					console.log(result);
			});
		};
	});
});

// TODO: Translate above in Python. From each route, save data from apis into mysql database, then create a websocket that returns the data that are constantly being stored into the db.
